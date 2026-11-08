import type { ZodType } from "zod";

/**
 * Nessie v2 client (ADR-002). Server-side only. One token bucket per client:
 * 120 req/min, burst 30. On 429 honors Retry-After and retries once.
 */
export interface NessieClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  ratePerMinute?: number;
  burst?: number;
}

export class NessieError extends Error {
  readonly name = "NessieError";
  constructor(
    readonly status: number,
    message: string,
    readonly retryAfter?: number,
    readonly body?: unknown,
  ) {
    super(message);
  }
}

export interface NessieClient {
  fetch<T = unknown>(path: string, init?: RequestInit & { schema?: ZodType<T> }): Promise<T>;
}

const DEFAULT_BASE_URL = "https://v2-prod-api.nessieisreal.com";
const DEFAULT_RATE_PER_MINUTE = 120;
const DEFAULT_BURST = 30;
const FALLBACK_RETRY_AFTER_S = 2;
const MAX_RETRY_AFTER_S = 30;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function makeBucket(ratePerMinute: number, burst: number) {
  const msPerToken = 60_000 / ratePerMinute;
  let tokens = burst;
  let last = Date.now();
  const refill = () => {
    const now = Date.now();
    const gained = Math.floor((now - last) / msPerToken);
    if (gained > 0) {
      tokens = Math.min(burst, tokens + gained);
      last += gained * msPerToken;
    }
  };
  return async function acquire(): Promise<void> {
    for (;;) {
      refill();
      if (tokens >= 1) {
        tokens -= 1;
        return;
      }
      const wait = msPerToken - (Date.now() - last);
      await sleep(Math.max(1, wait));
    }
  };
}

function parseRetryAfter(res: Response): number {
  const raw = Number(res.headers.get("retry-after"));
  if (!Number.isFinite(raw) || raw <= 0) return FALLBACK_RETRY_AFTER_S;
  return Math.min(raw, MAX_RETRY_AFTER_S);
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function createNessieClient(opts: NessieClientOptions): NessieClient {
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const fetchImpl = opts.fetchImpl ?? fetch;
  const acquire = makeBucket(opts.ratePerMinute ?? DEFAULT_RATE_PER_MINUTE, opts.burst ?? DEFAULT_BURST);

  async function once(path: string, init: RequestInit): Promise<Response> {
    await acquire();
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${opts.apiKey}`);
    headers.set("accept", "application/json");
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    return fetchImpl(`${baseUrl}${path}`, { ...init, headers });
  }

  return {
    async fetch<T>(path: string, init: RequestInit & { schema?: ZodType<T> } = {}): Promise<T> {
      const { schema, ...rest } = init;
      let res = await once(path, rest);
      if (res.status === 429) {
        await sleep(parseRetryAfter(res) * 1000);
        res = await once(path, rest);
        if (res.status === 429) {
          throw new NessieError(429, `Nessie rate limited: ${path}`, parseRetryAfter(res));
        }
      }
      const body = await readBody(res);
      if (!res.ok) {
        throw new NessieError(res.status, `Nessie ${res.status} on ${rest.method ?? "GET"} ${path}`, undefined, body);
      }
      if (schema) {
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          throw new NessieError(res.status, `Nessie response shape mismatch on ${path}: ${parsed.error.message}`, undefined, body);
        }
        return parsed.data;
      }
      return body as T;
    },
  };
}

let singleton: NessieClient | null = null;

/** Process-wide client built from env. Throws if NESSIE_API_KEY is missing. */
export function getNessie(): NessieClient {
  if (singleton) return singleton;
  const apiKey = process.env.NESSIE_API_KEY;
  if (!apiKey) throw new NessieError(0, "NESSIE_API_KEY is not set");
  singleton = createNessieClient({ apiKey, baseUrl: process.env.NESSIE_BASE_URL });
  return singleton;
}
