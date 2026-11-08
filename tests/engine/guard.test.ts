import { describe, expect, test } from "vitest";
import { guardDecision, ASK_ABOVE_CENTS, DECLINE_SHARE_OF_LIQUID, type PendingTxn } from "@/lib/engine/guard";
import { health } from "@/lib/engine/health";
import { brokeBundle, profileFor, typicalBundle } from "../fixtures/profiles";

const tx = (amount: number, extra: Partial<PendingTxn> = {}): PendingTxn => ({ id: "t1", kind: "purchase", amountCents: amount, description: "Target", merchantCategory: "retail", ...extra });

describe("guardDecision", () => {
  test("$800 purchase with $1,000 liquid → decline (over half of liquid)", () => {
    const p = profileFor("C003", typicalBundle());
    p.accounts = [{ id: "chk", kind: "checking", nickname: "x", balance: 100_000, available: 100_000 }];
    const d = guardDecision(tx(80_000), p, health(p));
    expect(d.decision).toBe("decline");
    expect(d.reason).toMatch(/liquid/i);
  });

  test("$40 groceries → approve", () => {
    const p = profileFor("C003");
    expect(guardDecision(tx(4_000, { description: "Tom Thumb", merchantCategory: "groceries" }), p, health(p)).decision).toBe("approve");
  });

  test(`purchase above $${ASK_ABOVE_CENTS / 100} with runway under 1 month → ask`, () => {
    const p = profileFor("C014", brokeBundle());
    p.accounts = [{ id: "chk", kind: "checking", nickname: "x", balance: 500_000, available: 500_000 }];
    const h = { ...health(p), runwayMonths: 0.5 };
    expect(guardDecision(tx(ASK_ABOVE_CENTS + 1), p, h).decision).toBe("ask");
  });

  test("gambling merchant category → decline regardless of amount", () => {
    const p = profileFor("C003");
    expect(guardDecision(tx(1_000, { merchantCategory: "gambling" }), p, health(p)).decision).toBe("decline");
  });

  test("deposits are always approved", () => {
    const p = profileFor("C003");
    expect(guardDecision(tx(10_000_000, { kind: "deposit" }), p, health(p)).decision).toBe("approve");
  });

  test(`decline threshold is ${DECLINE_SHARE_OF_LIQUID * 100}% of liquid: just under passes`, () => {
    const p = profileFor("C003");
    p.accounts = [{ id: "chk", kind: "checking", nickname: "x", balance: 100_000, available: 100_000 }];
    expect(guardDecision(tx(49_000), p, { ...health(p), runwayMonths: 5 }).decision).toBe("approve");
  });
});
