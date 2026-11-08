import { createHmac, timingSafeEqual } from "node:crypto";

/** Nessie-Signature = HMAC-SHA256(secret, `${timestamp}.${body}`); header may be raw hex or "t=<ts>,v1=<hex>". */
export const MAX_SKEW_SECONDS = 300;

export interface VerifyInput { secret: string; timestamp: string | null; body: string; signature: string | null; nowSeconds?: number }

export function verifyNessieSignature(i: VerifyInput): boolean {
  if (!i.secret || !i.body || !i.signature) return false;
  let ts = i.timestamp;
  let sig = i.signature.trim();
  const m = sig.match(/t=(\d+)/);
  if (m) ts = ts ?? m[1];
  const v1 = sig.match(/v1=([0-9a-f]+)/i);
  if (v1) sig = v1[1];
  if (!ts || !/^\d+$/.test(ts)) return false;
  const now = i.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(ts)) > MAX_SKEW_SECONDS) return false;
  const expected = createHmac("sha256", i.secret).update(`${ts}.${i.body}`).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(sig.toLowerCase(), "hex");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/** At-least-once delivery: remember event ids for a window. */
export class DedupeWindow {
  private readonly seenAt = new Map<string, number>();
  constructor(private readonly windowMs = 10 * 60_000) {}
  seen(id: string, now = Date.now()): boolean {
    for (const [k, t] of this.seenAt) if (now - t > this.windowMs) this.seenAt.delete(k);
    if (this.seenAt.has(id)) return true;
    this.seenAt.set(id, now);
    return false;
  }
}
