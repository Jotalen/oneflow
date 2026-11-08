import { describe, expect, test } from "vitest";
import { txBelongsTo } from "@/lib/engine/ownership";

const ids = { customerId: "c", checkingId: "chk", savingsId: "sav", cardId: "card", cdId: "cd", billIds: [] };

describe("txBelongsTo", () => {
  test("true when payer or payee is one of the persona's accounts", () => {
    expect(txBelongsTo({ payer_id: "chk" }, ids)).toBe(true);
    expect(txBelongsTo({ payee_id: "cd" }, ids)).toBe(true);
  });
  test("false for a stranger's account", () => {
    expect(txBelongsTo({ payer_id: "zzz", payee_id: "yyy" }, ids)).toBe(false);
    expect(txBelongsTo({}, ids)).toBe(false);
  });
});
