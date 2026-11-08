import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import { verifyNessieSignature, DedupeWindow, MAX_SKEW_SECONDS } from "@/lib/nessie/webhook";

const secret = "whsec_test";
const body = JSON.stringify({ id: "evt1", tx: { id: "t1", kind: "purchase", amount_cents: 80000 } });
const sign = (ts: string, b = body, s = secret) => createHmac("sha256", s).update(`${ts}.${b}`).digest("hex");

describe("verifyNessieSignature", () => {
  test("accepts a fresh, correctly signed body", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    expect(verifyNessieSignature({ secret, timestamp: ts, body, signature: sign(ts) })).toBe(true);
  });
  test("accepts the 't=..,v1=..' header form", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    expect(verifyNessieSignature({ secret, timestamp: ts, body, signature: `t=${ts},v1=${sign(ts)}` })).toBe(true);
  });
  test("rejects a tampered body", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    expect(verifyNessieSignature({ secret, timestamp: ts, body: body + " ", signature: sign(ts) })).toBe(false);
  });
  test("rejects the wrong secret", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    expect(verifyNessieSignature({ secret: "other", timestamp: ts, body, signature: sign(ts) })).toBe(false);
  });
  test(`rejects timestamps older than ${MAX_SKEW_SECONDS}s`, () => {
    const ts = String(Math.floor(Date.now() / 1000) - MAX_SKEW_SECONDS - 5);
    expect(verifyNessieSignature({ secret, timestamp: ts, body, signature: sign(ts) })).toBe(false);
  });
  test("rejects missing pieces without throwing", () => {
    expect(verifyNessieSignature({ secret, timestamp: null, body, signature: null })).toBe(false);
  });
});

describe("DedupeWindow", () => {
  test("first sight is new, second is a duplicate, old ids expire", () => {
    const d = new DedupeWindow(1000);
    expect(d.seen("a", 0)).toBe(false);
    expect(d.seen("a", 10)).toBe(true);
    expect(d.seen("a", 2000)).toBe(false);
  });
});
