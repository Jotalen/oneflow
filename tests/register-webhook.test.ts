import { describe, expect, test, vi } from "vitest";
import { createNessieClient } from "@/lib/nessie/client";
import { buildDecisionHook, parseArgs, readWebhookSpec, registerWebhook, type RegisterOptions } from "../scripts/register-webhook";

const URL_PROD = "https://www.one-flow.us/api/webhook/decision";
const SECRET = "whsec_super_secret_value";
const spec = readWebhookSpec();

interface Call { method: string; path: string; body: unknown; auth: string | null }

/** Fake Nessie: records every request and answers from a small in-memory hook list. */
function fakeNessie(existing: Record<string, unknown>[] = []) {
  const calls: Call[] = [];
  const hooks = [...existing];
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const u = new URL(String(input));
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: u.pathname, body, auth: new Headers(init?.headers).get("authorization") });
    const json = (status: number, b: unknown) => new Response(b === undefined ? null : JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
    if (method === "GET" && u.pathname === "/webhooks") return json(200, { items: hooks });
    if (method === "POST" && u.pathname === "/webhooks") return json(200, { id: "wh_new", ...body, active: true, secret: SECRET });
    if (method === "DELETE") return json(204, undefined);
    if (method === "POST" && u.pathname.endsWith("/secret/rotate")) return json(200, { ...hooks[0], secret: SECRET });
    if (method === "POST" && u.pathname.endsWith("/ping")) return json(200, { id: "dlv_1", event_type: "ping", attempt: 1, status: "pending", created_at: "now" });
    if (method === "GET" && u.pathname.endsWith("/deliveries")) return json(200, { items: [{ id: "dlv_1", event_type: "ping", attempt: 1, status: "delivered", http_status: 200, created_at: "now" }] });
    return json(404, { type: "not_found" });
  });
  const client = createNessieClient({ apiKey: "test-key", baseUrl: "https://nessie.test", fetchImpl: fetchImpl as unknown as typeof fetch });
  return { client, calls };
}

function io() {
  const lines: string[] = [];
  const secrets: string[] = [];
  return { lines, secrets, deps: { log: (s: string) => lines.push(s), writeSecret: (s: string) => { secrets.push(s); return ".env.webhook-secret"; }, sleep: async () => {} } };
}

const opts = (o: Partial<RegisterOptions> = {}): RegisterOptions => ({ ...parseArgs(["--url", URL_PROD]), ...o });

describe("readWebhookSpec", () => {
  test("reads the decision-hook schema from docs/openapi-nessie.json", () => {
    expect(spec.modes).toContain("decision");
    expect(spec.kinds).toContain("purchase");
    expect(spec.onError).toEqual(expect.arrayContaining(["approve", "decline"]));
    expect(spec.maxWaitSeconds).toEqual({ min: 1, max: 300 });
    expect(spec.required).toEqual(expect.arrayContaining(["mode", "url"]));
  });
});

describe("parseArgs", () => {
  test("defaults: purchase kind, fail open, 30s wait, real run", () => {
    expect(parseArgs(["--url", URL_PROD])).toMatchObject({ url: URL_PROD, kind: "purchase", onError: "approve", maxWaitSeconds: 30, dryRun: false, replace: false, rotateSecret: false, verify: false });
  });
  test("flags", () => {
    expect(parseArgs(["--url", URL_PROD, "--dry-run", "--replace", "--on-error", "decline", "--max-wait", "60"])).toMatchObject({ dryRun: true, replace: true, onError: "decline", maxWaitSeconds: 60 });
  });
});

describe("buildDecisionHook", () => {
  test("builds the WebhookCreateDTO for a purchase decision hook", () => {
    expect(buildDecisionHook(opts(), spec)).toEqual({ mode: "decision", url: URL_PROD, kinds: ["purchase"], on_error: "approve", max_wait_seconds: 30 });
  });
  test("refuses non-https, localhost, unknown kinds and out-of-range waits", () => {
    expect(() => buildDecisionHook(opts({ url: "http://www.one-flow.us/api/webhook/decision" }), spec)).toThrow(/https/);
    expect(() => buildDecisionHook(opts({ url: "https://localhost:3001/api/webhook/decision" }), spec)).toThrow(/public/);
    expect(() => buildDecisionHook(opts({ url: "" }), spec)).toThrow(/--url/);
    expect(() => buildDecisionHook(opts({ kind: "teleport" }), spec)).toThrow(/kind/);
    expect(() => buildDecisionHook(opts({ maxWaitSeconds: 301 }), spec)).toThrow(/max-wait/);
  });
});

describe("registerWebhook", () => {
  test("creates the hook when none exists, saves the secret, and never logs it", async () => {
    const { client, calls } = fakeNessie();
    const o = io();
    const out = await registerWebhook(client, opts(), spec, o.deps);
    expect(out).toMatchObject({ action: "created", hookId: "wh_new" });
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(["GET /webhooks", "POST /webhooks"]);
    expect(calls[1].body).toEqual({ mode: "decision", url: URL_PROD, kinds: ["purchase"], on_error: "approve", max_wait_seconds: 30 });
    expect(calls.every((c) => c.auth === "Bearer test-key")).toBe(true);
    expect(o.secrets).toEqual([SECRET]);
    expect(o.lines.join("\n")).not.toContain(SECRET);
    expect(o.lines.join("\n")).toMatch(/NESSIE_WEBHOOK_SECRET/);
  });

  test("--dry-run only lists, prints the request, and changes nothing", async () => {
    const { client, calls } = fakeNessie();
    const o = io();
    const out = await registerWebhook(client, opts({ dryRun: true }), spec, o.deps);
    expect(out.action).toBe("dry-run");
    expect(calls.map((c) => c.method)).toEqual(["GET"]);
    expect(o.lines.join("\n")).toContain('"kinds": [\n    "purchase"');
    expect(o.secrets).toEqual([]);
  });

  test("is idempotent: an existing purchase hook at the same URL is left alone", async () => {
    const { client, calls } = fakeNessie([{ id: "wh_1", mode: "decision", url: URL_PROD, kinds: ["purchase"], active: true }]);
    const o = io();
    const out = await registerWebhook(client, opts(), spec, o.deps);
    expect(out).toMatchObject({ action: "exists", hookId: "wh_1" });
    expect(calls.map((c) => c.method)).toEqual(["GET"]);
  });

  test("ignores notify hooks and decision hooks for other kinds", async () => {
    const { client } = fakeNessie([
      { id: "wh_n", mode: "notify", url: URL_PROD, events: [], active: true },
      { id: "wh_t", mode: "decision", url: "https://elsewhere.example/hook", kinds: ["transfer"], active: true },
    ]);
    expect((await registerWebhook(client, opts(), spec, io().deps)).action).toBe("created");
  });

  test("stops on a purchase hook pointing elsewhere unless --replace, which deletes it first", async () => {
    const other = { id: "wh_old", mode: "decision", url: "https://old.example/hook", kinds: ["purchase"], active: true };
    const a = fakeNessie([other]);
    expect((await registerWebhook(a.client, opts(), spec, io().deps)).action).toBe("conflict");
    expect(a.calls.map((c) => c.method)).toEqual(["GET"]);

    const b = fakeNessie([other]);
    const out = await registerWebhook(b.client, opts({ replace: true }), spec, io().deps);
    expect(out.action).toBe("replaced");
    expect(b.calls.map((c) => `${c.method} ${c.path}`)).toEqual(["GET /webhooks", "DELETE /webhooks/wh_old", "POST /webhooks"]);
  });

  test("--rotate-secret on an existing hook saves the new secret without logging it", async () => {
    const { client, calls } = fakeNessie([{ id: "wh_1", mode: "decision", url: URL_PROD, kinds: ["purchase"], active: true }]);
    const o = io();
    await registerWebhook(client, opts({ rotateSecret: true }), spec, o.deps);
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(["GET /webhooks", "POST /webhooks/wh_1/secret/rotate"]);
    expect(o.secrets).toEqual([SECRET]);
    expect(o.lines.join("\n")).not.toContain(SECRET);
  });

  test("--verify pings the hook and reports the delivery result", async () => {
    const { client, calls } = fakeNessie([{ id: "wh_1", mode: "decision", url: URL_PROD, kinds: ["purchase"], active: true }]);
    const o = io();
    await registerWebhook(client, opts({ verify: true }), spec, o.deps);
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(["GET /webhooks", "POST /webhooks/wh_1/ping", "GET /webhooks/wh_1/deliveries"]);
    expect(o.lines.join("\n")).toMatch(/delivered.*200/);
  });
});
