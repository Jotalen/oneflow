import { describe, expect, test, vi } from "vitest";

vi.mock("../scripts/_seed-ids", () => ({ writeSeedIds: vi.fn() }));

describe("resetPersona", () => {
  test("also deletes accounts and bills created at runtime (CDs, autopay bills), not only seeded ids", async () => {
    const { resetPersona } = await import("../scripts/reset");
    const deleted: string[] = [];
    const del = (kind: string) => vi.fn(async (id: string) => { deleted.push(`${kind}:${id}`); });
    const api = {
      getCustomerAccounts: vi.fn(async () => [{ id: "chk" }, { id: "sav" }, { id: "card" }, { id: "cd_runtime" }]),
      getAccountBills: vi.fn(async (acct: string) => (acct === "chk" ? [{ id: "b_seed" }, { id: "b_autopay_runtime" }] : [])),
      getAccountLoans: vi.fn(async () => []),
      deleteBill: del("bill"), deleteLoan: del("loan"), deleteAccount: del("acct"), deleteCustomer: del("cust"),
    };
    const ids = { personas: { C018: { customerId: "cust", checkingId: "chk", savingsId: "sav", cardId: "card", billIds: ["b_seed"] } } };
    await resetPersona(api as never, ids as never, "C018");
    expect(deleted).toEqual(expect.arrayContaining(["bill:b_seed", "bill:b_autopay_runtime", "acct:cd_runtime", "acct:chk", "cust:cust"]));
    expect(deleted.indexOf("cust:cust")).toBe(deleted.length - 1);
    expect(new Set(deleted).size).toBe(deleted.length);
  });
});
