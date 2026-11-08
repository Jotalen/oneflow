/**
 * Register OneFlow's Nessie decision-mode webhook (idempotent).
 *
 *   pnpm webhook:register --url https://www.one-flow.us/api/webhook/decision [--dry-run]
 *     [--kind purchase] [--on-error approve|decline] [--max-wait 30]
 *     [--replace] [--rotate-secret] [--verify] [--secret-out .env.webhook-secret]
 *
 * Lists hooks first and skips if a decision hook for the kind already points at --url.
 * The signing secret (shown once by Nessie) is written to a git-ignored file, never printed.
 * The request shape comes from WebhookCreateDTO in docs/openapi-nessie.json.
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { createNessieClient, type NessieClient } from "@/lib/nessie/client";
import { list } from "@/lib/nessie/types";
import type { WebhookCreate } from "@/lib/nessie/api";
import { loadEnv } from "./_env";

const OPENAPI_PATH = path.join(process.cwd(), "docs", "openapi-nessie.json");
const DEFAULT_SECRET_OUT = ".env.webhook-secret"; // matches .gitignore's `.env*`
const DEFAULT_KIND = "purchase";
const DEFAULT_MAX_WAIT_S = 30;
const VERIFY_WAIT_MS = 5_000;
const SECRET_FILE_MODE = 0o600;
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.0|\[?::1\]?$)|\.local$/i;

export interface WebhookSpec { modes: string[]; kinds: string[]; onError: string[]; maxWaitSeconds: { min: number; max: number }; required: string[] }

/** WebhookCreateDTO's enums and limits, read from the vendored OpenAPI so the script tracks the API. */
export function readWebhookSpec(openapiPath = OPENAPI_PATH): WebhookSpec {
  const doc = JSON.parse(fs.readFileSync(openapiPath, "utf8")) as { components: { schemas: Record<string, { properties: Record<string, { enum?: string[]; items?: { enum?: string[] }; minimum?: number; maximum?: number }>; required?: string[] }> } };
  const dto = doc.components.schemas.WebhookCreateDTO;
  if (!dto) throw new Error("WebhookCreateDTO missing from docs/openapi-nessie.json");
  const p = dto.properties;
  const nonEmpty = (xs: string[] = []) => xs.filter(Boolean);
  return {
    modes: nonEmpty(p.mode?.enum),
    kinds: nonEmpty(p.kinds?.items?.enum),
    onError: nonEmpty(p.on_error?.enum),
    maxWaitSeconds: { min: p.max_wait_seconds?.minimum ?? 1, max: p.max_wait_seconds?.maximum ?? 300 },
    required: dto.required ?? [],
  };
}

export interface RegisterOptions {
  url: string; kind: string; onError: "approve" | "decline"; maxWaitSeconds: number;
  dryRun: boolean; replace: boolean; rotateSecret: boolean; verify: boolean; secretOut: string;
}

export function parseArgs(argv: readonly string[]): RegisterOptions {
  const val = (name: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
  const has = (name: string) => argv.includes(`--${name}`);
  return {
    url: val("url") ?? "",
    kind: val("kind") ?? DEFAULT_KIND,
    onError: val("on-error") === "decline" ? "decline" : "approve",
    maxWaitSeconds: Number(val("max-wait") ?? DEFAULT_MAX_WAIT_S),
    dryRun: has("dry-run"),
    replace: has("replace"),
    rotateSecret: has("rotate-secret"),
    verify: has("verify"),
    secretOut: val("secret-out") ?? DEFAULT_SECRET_OUT,
  };
}

/** The POST /webhooks body. Throws on anything Nessie (or hosted delivery) would refuse. */
export function buildDecisionHook(o: RegisterOptions, spec: WebhookSpec): WebhookCreate {
  if (!o.url) throw new Error("--url is required, e.g. --url https://www.one-flow.us/api/webhook/decision");
  let u: URL;
  try { u = new URL(o.url); } catch { throw new Error(`--url is not a valid URL: ${o.url}`); }
  if (u.protocol !== "https:") throw new Error("--url must be https (hosted Nessie only calls https)");
  if (PRIVATE_HOST.test(u.hostname)) throw new Error("--url must be a public host (hosted Nessie refuses localhost and private ranges)");
  if (!spec.modes.includes("decision")) throw new Error("OpenAPI has no decision mode");
  if (!spec.kinds.includes(o.kind)) throw new Error(`unknown kind ${o.kind}; one of ${spec.kinds.join(", ")}`);
  if (!spec.onError.includes(o.onError)) throw new Error(`--on-error must be one of ${spec.onError.join(", ")}`);
  const { min, max } = spec.maxWaitSeconds;
  if (!Number.isInteger(o.maxWaitSeconds) || o.maxWaitSeconds < min || o.maxWaitSeconds > max) throw new Error(`--max-wait must be an integer ${min}-${max}`);
  return { mode: "decision", url: u.toString(), kinds: [o.kind], on_error: o.onError, max_wait_seconds: o.maxWaitSeconds };
}

const Hook = z.object({ id: z.string(), mode: z.string(), url: z.string(), kinds: z.array(z.string()).nullable().optional(), secret: z.string().optional() }).passthrough();
type Hook = z.infer<typeof Hook>;
const Delivery = z.object({ id: z.string(), status: z.string(), http_status: z.number().optional(), outcome: z.string().optional(), error: z.string().optional() }).passthrough();

export interface Deps { log: (line: string) => void; writeSecret: (secret: string) => string; sleep: (ms: number) => Promise<void> }
export interface Outcome { action: "dry-run" | "created" | "replaced" | "exists" | "conflict"; hookId?: string }

function secretInstructions(log: Deps["log"], savedTo: string | null, url: string): void {
  if (!savedTo) { log("Nessie returned no secret. Run again with --rotate-secret to get one."); return; }
  log(`Signing secret saved to ${savedTo} (mode 600, git-ignored). It is not printed here.`);
  log("Next steps:");
  log(`  1. Vercel > Project > Settings > Environment Variables (Production): NESSIE_WEBHOOK_SECRET = contents of ${savedTo}`);
  log(`     or: vercel env add NESSIE_WEBHOOK_SECRET production < ${savedTo}`);
  log("  2. Redeploy. Until then the route answers 503 and Nessie falls back to on_error.");
  log(`  3. Check the wiring: pnpm webhook:register --url ${url} --verify`);
  log(`  4. Delete ${savedTo}. If the secret is ever lost, run with --rotate-secret.`);
}

async function verify(client: NessieClient, hookId: string, deps: Deps): Promise<void> {
  await client.fetch(`/webhooks/${hookId}/ping`, { method: "POST", schema: Delivery });
  await deps.sleep(VERIFY_WAIT_MS);
  const recent = await client.fetch(`/webhooks/${hookId}/deliveries`, { schema: list(Delivery) });
  const d = recent[0];
  deps.log(d ? `Latest delivery: ${d.status} http ${d.http_status ?? "-"}${d.outcome ? ` outcome ${d.outcome}` : ""}${d.error ? ` error ${d.error}` : ""}` : "No deliveries yet; check again in a minute.");
}

async function create(client: NessieClient, body: WebhookCreate, deps: Deps): Promise<Hook> {
  const hook = await client.fetch("/webhooks", { method: "POST", body: JSON.stringify(body), schema: Hook });
  deps.log(`Registered decision hook ${hook.id} for ${body.kinds?.join(",")} -> ${body.url}`);
  secretInstructions(deps.log, hook.secret ? deps.writeSecret(hook.secret) : null, body.url);
  return hook;
}

export async function registerWebhook(client: NessieClient, o: RegisterOptions, spec: WebhookSpec, deps: Deps): Promise<Outcome> {
  const body = buildDecisionHook(o, spec);
  const hooks = await client.fetch("/webhooks", { schema: list(Hook) });
  const existing = hooks.find((h) => h.mode === "decision" && (h.kinds ?? []).includes(o.kind));
  const sameUrl = existing && existing.url === body.url;

  if (o.dryRun) {
    deps.log(existing ? `Found decision hook ${existing.id} for ${o.kind} -> ${existing.url}` : `No decision hook for ${o.kind} yet.`);
    deps.log(sameUrl ? "Would skip: already registered." : `Would ${existing ? `DELETE /webhooks/${existing.id} (needs --replace), then ` : ""}POST /webhooks with:`);
    if (!sameUrl) deps.log(JSON.stringify(body, null, 2));
    return { action: "dry-run", hookId: existing?.id };
  }
  if (existing && sameUrl) {
    deps.log(`Already registered: decision hook ${existing.id} for ${o.kind} -> ${existing.url}. Nothing to do.`);
    if (o.rotateSecret) {
      const rotated = await client.fetch(`/webhooks/${existing.id}/secret/rotate`, { method: "POST", schema: Hook });
      secretInstructions(deps.log, rotated.secret ? deps.writeSecret(rotated.secret) : null, body.url);
    }
    if (o.verify) await verify(client, existing.id, deps);
    return { action: "exists", hookId: existing.id };
  }
  if (existing && !o.replace) {
    deps.log(`A decision hook for ${o.kind} already points at ${existing.url} (${existing.id}). Nessie allows one per kind; pass --replace to delete it and register ${body.url}.`);
    return { action: "conflict", hookId: existing.id };
  }
  if (existing) {
    await client.fetch(`/webhooks/${existing.id}`, { method: "DELETE" });
    deps.log(`Deleted old decision hook ${existing.id} (${existing.url}).`);
  }
  const hook = await create(client, body, deps);
  if (o.verify) deps.log("Skipping --verify: set the secret in Vercel and redeploy first, then run --verify.");
  return { action: existing ? "replaced" : "created", hookId: hook.id };
}

function writeSecretFile(file: string): (secret: string) => string {
  return (secret) => {
    const p = path.resolve(process.cwd(), file);
    fs.writeFileSync(p, secret, { mode: SECRET_FILE_MODE });
    fs.chmodSync(p, SECRET_FILE_MODE);
    return file;
  };
}

async function main(): Promise<void> {
  loadEnv();
  const apiKey = process.env.NESSIE_API_KEY;
  if (!apiKey) throw new Error("NESSIE_API_KEY missing. Put it in .env.local");
  const o = parseArgs(process.argv.slice(2));
  const client = createNessieClient({ apiKey, baseUrl: process.env.NESSIE_BASE_URL });
  const deps: Deps = { log: (s) => console.log(s), writeSecret: writeSecretFile(o.secretOut), sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };
  const out = await registerWebhook(client, o, readWebhookSpec(), deps);
  if (out.action === "conflict") process.exitCode = 2;
}

if (process.argv[1]?.endsWith("register-webhook.ts")) {
  main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
}
