import { describe, expect, test } from "vitest";
import { bankMoves } from "@/lib/engine/moves/bank";
import { brokeBundle, profileFor, typicalBundle } from "../fixtures/profiles";

describe("bankMoves", () => {
  test("card balance yields pay_highest_apr with extra toward debt", () => {
    const m = bankMoves(profileFor("C003")).find((x) => x.id === "pay_highest_apr");
    expect(m).toBeDefined();
    expect(m!.overrides.extraToDebtMonthly).toBeGreaterThan(0);
    expect(m!.impactKind).toBe("netWorth");
  });

  test("when the highest-APR debt is the card, the move pays the card in Nessie (not savings)", () => {
    const m = bankMoves(profileFor("C003")).find((x) => x.id === "pay_highest_apr")!;
    expect(m.execution).toEqual([expect.objectContaining({ op: "transfer", from: "checking", to: "card" })]);
  });

  test("lease persona with no APR debt does not throw and omits pay_highest_apr", () => {
    const b = typicalBundle();
    b.accounts = b.accounts.filter((a) => a.type !== "Credit Card");
    const moves = bankMoves(profileFor("C003", b));
    expect(moves.find((x) => x.id === "pay_highest_apr")).toBeUndefined();
  });

  test("broke profile gets build_runway_3mo", () => {
    const m = bankMoves(profileFor("C014", brokeBundle())).find((x) => x.id === "build_runway_3mo");
    expect(m).toBeDefined();
    expect(m!.impactKind).toBe("risk");
    expect(m!.execution?.[0]).toMatchObject({ op: "transfer" });
  });

  test("large idle savings yields idle_cash_to_cd; existing CD suppresses it", () => {
    const b = typicalBundle();
    b.accounts[1] = { ...b.accounts[1], balance_cents: 5_000_000, available_cents: 5_000_000 };
    expect(bankMoves(profileFor("C003", b)).find((x) => x.id === "idle_cash_to_cd")).toBeDefined();
    b.accounts.push({ id: "cd", type: "Savings", nickname: "CD 12mo", balance_cents: 100, available_cents: 100 });
    expect(bankMoves(profileFor("C003", b)).find((x) => x.id === "idle_cash_to_cd")).toBeUndefined();
  });

  test("subscriptions yield cancel_recurring with bill ids", () => {
    const m = bankMoves(profileFor("C003")).find((x) => x.id === "cancel_recurring");
    expect(m).toBeDefined();
    expect((m!.overrides.cancelBillIds as string[]).length).toBeGreaterThan(0);
    expect(m!.execution?.every((op) => op.op === "cancelBill")).toBe(true);
  });

  test("due_date_to_payday only when contract due day differs from payday", () => {
    const p = profileFor("C001", brokeBundle()); // due 1st, paid 15th, no cash cushion
    expect(bankMoves(p).find((x) => x.id === "due_date_to_payday")).toBeDefined();
    const aligned = { ...p, contract: { ...p.contract!, dueDay: p.paydayDay } };
    expect(bankMoves(aligned).find((x) => x.id === "due_date_to_payday")).toBeUndefined();
  });

  test("due_date_to_payday not offered when the payment is due after payday", () => {
    const p = profileFor("C001", brokeBundle());
    const dueAfter = { ...p, contract: { ...p.contract!, dueDay: p.paydayDay + 2 } };
    expect(bankMoves(dueAfter).find((x) => x.id === "due_date_to_payday")).toBeUndefined();
  });

  test("due_date_to_payday not offered when checking already covers the payment and a month of essentials", () => {
    const rich = typicalBundle();
    rich.accounts = rich.accounts.map((a) => (a.type === "Checking" ? { ...a, balance_cents: 5_000_000, available_cents: 5_000_000 } : a));
    expect(bankMoves(profileFor("C018", rich)).find((x) => x.id === "due_date_to_payday")).toBeUndefined();
  });

  test("set_autopay not offered again once a recurring Toyota bill exists (no duplicate payments)", () => {
    const b = typicalBundle();
    b.bills = [...b.bills, { id: "tfs", status: "recurring", payee: "Toyota Financial Services", payment_amount: 749.61, recurring_date: 1 }];
    expect(bankMoves(profileFor("C005", b)).find((x) => x.id === "set_autopay")).toBeUndefined();
  });

  test("set_autopay offered when autopay is off", () => {
    const m = bankMoves(profileFor("C005")).find((x) => x.id === "set_autopay"); // mails a check
    expect(m).toBeDefined();
    expect(m!.execution?.[0]).toMatchObject({ op: "createBill" });
  });
});
