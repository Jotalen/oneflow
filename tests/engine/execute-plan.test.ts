import { describe, expect, test, vi } from "vitest";
import { executeMove, planExecution, type PersonaIds } from "@/lib/engine/execute";
import { bankMoves } from "@/lib/engine/moves/bank";
import { brokeBundle, profileFor } from "../fixtures/profiles";

const ids: PersonaIds = { customerId: "cust", checkingId: "chk", savingsId: "sav", cardId: "card", loanId: "loan", billIds: ["b1", "b2"] };

describe("planExecution", () => {
  test("build_runway_3mo → one transfer checking→savings of the monthly amount", () => {
    const p = profileFor("C014", brokeBundle());
    const m = bankMoves(p).find((x) => x.id === "build_runway_3mo")!;
    const ops = planExecution(m, ids);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ op: "transfer", accountId: "chk", payee_id: "sav", amount_cents: m.overrides.savingsTransferMonthly });
  });

  test("set_autopay → recurring bill on the contract due day for the contract payment", () => {
    const p = profileFor("C005");
    const m = bankMoves(p).find((x) => x.id === "set_autopay")!;
    const ops = planExecution(m, ids);
    expect(ops[0]).toMatchObject({ op: "createBill", accountId: "chk", amountCents: p.contract!.monthlyPayment, recurring_date: p.contract!.dueDay, status: "recurring" });
  });

  test("cancel_recurring → one cancelBill per subscription", () => {
    const p = profileFor("C003");
    const m = bankMoves(p).find((x) => x.id === "cancel_recurring")!;
    const ops = planExecution(m, ids);
    expect(ops.length).toBe((m.overrides.cancelBillIds as string[]).length);
    expect(ops.every((o) => o.op === "cancelBill")).toBe(true);
  });

  test("openCd → create a CD savings account then transfer from savings", () => {
    const p = profileFor("C003");
    const m = { ...bankMoves(p)[0], id: "idle_cash_to_cd", execution: [{ op: "openCd" as const, amount: 100_000 }] };
    const ops = planExecution(m, ids);
    expect(ops.map((o) => o.op)).toEqual(["openCd", "transfer"]);
  });

  test("move without execution plans nothing", () => {
    const p = profileFor("C001", brokeBundle());
    const m = bankMoves(p).find((x) => x.id === "due_date_to_payday")!;
    expect(planExecution(m, ids)).toEqual([]);
  });
});

describe("executeMove", () => {
  test("runs ops in order and returns transaction ids", async () => {
    const api = {
      transfer: vi.fn(async () => ({ id: "t1", kind: "transfer", status: "pending", amount_cents: 1 })),
      createBill: vi.fn(async () => ({ id: "b9", status: "recurring", payee: "x", payment_amount: 1 })),
      updateBill: vi.fn(async () => ({ id: "b1", status: "cancelled", payee: "x", payment_amount: 1 })),
      createAccount: vi.fn(async () => ({ id: "cd1", type: "Savings", nickname: "CD 12mo", balance_cents: 0 })),
    };
    const p = profileFor("C014", brokeBundle());
    const m = bankMoves(p).find((x) => x.id === "build_runway_3mo")!;
    const r = await executeMove(api as never, m, ids);
    expect(r).toEqual({ ok: true, txIds: ["t1"], billIds: [], accountIds: [] });
    expect(api.transfer).toHaveBeenCalledWith("chk", expect.objectContaining({ payee_id: "sav" }));
  });

  test("openCd closes the new CD again when funding it fails, so no empty CD is left behind", async () => {
    const { NessieError } = await import("@/lib/nessie/client");
    const api = {
      createAccount: vi.fn(async () => ({ id: "cd1", type: "Savings", nickname: "CD 12mo", balance_cents: 0 })),
      transfer: vi.fn(async () => { throw new NessieError(422, "insufficient funds"); }),
      deleteAccount: vi.fn(async () => undefined),
    };
    const m = { ...bankMoves(profileFor("C003"))[0], id: "idle_cash_to_cd", execution: [{ op: "openCd" as const, amount: 100_000 }] };
    const r = await executeMove(api as never, m, ids);
    expect(r).toMatchObject({ ok: false, status: 422 });
    expect(api.deleteAccount).toHaveBeenCalledWith("cd1");
  });

  test("surfaces NessieError as ok:false with retryAfter", async () => {
    const { NessieError } = await import("@/lib/nessie/client");
    const api = { transfer: vi.fn(async () => { throw new NessieError(429, "slow", 7); }) };
    const p = profileFor("C014", brokeBundle());
    const m = bankMoves(p).find((x) => x.id === "build_runway_3mo")!;
    const r = await executeMove(api as never, m, ids);
    expect(r).toMatchObject({ ok: false, retryAfter: 7 });
  });
});
