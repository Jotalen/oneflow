import { toDollars, type Cents } from "@/lib/money";
import type { NessieApi } from "@/lib/nessie/api";
import { NessieError } from "@/lib/nessie/client";
import type { Move } from "./types";

export interface PersonaIds { customerId: string; checkingId: string; savingsId: string; cardId: string; cdId?: string; loanId?: string; billIds: string[] }

export type ConcreteOp =
  | { op: "transfer"; accountId: string; payee_id: string; amount_cents: Cents; description: string }
  | { op: "createBill"; accountId: string; status: "recurring"; payee: string; amountCents: Cents; recurring_date: number; nickname: string }
  | { op: "cancelBill"; billId: string }
  | { op: "openCd"; customerId: string; nickname: string; amountCents: Cents };

export type ExecResult =
  | { ok: true; txIds: string[]; billIds: string[]; accountIds: string[] }
  | { ok: false; error: string; status?: number; retryAfter?: number };

const CD_NICKNAME = "CD 12mo";

/** Resolve a move's symbolic ops (checking/savings) to concrete Nessie calls for this persona. */
export function planExecution(move: Move, ids: PersonaIds): ConcreteOp[] {
  const acct = (k: "checking" | "savings" | "cd" | "card") => ({ checking: ids.checkingId, savings: ids.savingsId, cd: ids.cdId ?? ids.savingsId, card: ids.cardId })[k];
  return (move.execution ?? []).flatMap((o): ConcreteOp[] => {
    switch (o.op) {
      case "transfer":
        return [{ op: "transfer", accountId: acct(o.from), payee_id: acct(o.to), amount_cents: o.amount, description: o.description }];
      case "createBill":
        return [{ op: "createBill", accountId: ids.checkingId, status: "recurring", payee: o.payee, amountCents: o.amount, recurring_date: o.recurringDay, nickname: o.nickname }];
      case "cancelBill":
        return [{ op: "cancelBill", billId: o.billId }];
      case "openCd":
        return [
          { op: "openCd", customerId: ids.customerId, nickname: CD_NICKNAME, amountCents: o.amount },
          { op: "transfer", accountId: ids.savingsId, payee_id: "__new_cd__", amount_cents: o.amount, description: "Move idle cash to CD" },
        ];
    }
  });
}

/** Execute in order; stop at the first Nessie error. Bill amounts convert to dollars inside api.createBill (ADR-006). */
export async function executeMove(api: Pick<NessieApi, "transfer" | "createBill" | "updateBill" | "createAccount" | "deleteAccount">, move: Move, ids: PersonaIds): Promise<ExecResult> {
  const txIds: string[] = [];
  const billIds: string[] = [];
  const accountIds: string[] = [];
  let newCdId: string | null = null;
  let cdFunded = false;
  try {
    for (const op of planExecution(move, ids)) {
      switch (op.op) {
        case "transfer": {
          const payee = op.payee_id === "__new_cd__" ? newCdId ?? ids.savingsId : op.payee_id;
          const t = await api.transfer(op.accountId, { payee_id: payee, amount_cents: op.amount_cents, description: op.description });
          txIds.push(t.id);
          if (op.payee_id === "__new_cd__") cdFunded = true;
          break;
        }
        case "createBill": {
          const b = await api.createBill(op.accountId, { status: op.status, payee: op.payee, amountCents: op.amountCents, recurring_date: op.recurring_date, nickname: op.nickname });
          billIds.push(b.id);
          break;
        }
        case "cancelBill": {
          const b = await api.updateBill(op.billId, { status: "cancelled" });
          billIds.push(b.id);
          break;
        }
        case "openCd": {
          const a = await api.createAccount(op.customerId, { type: "Savings", nickname: op.nickname, balance_cents: 0 });
          newCdId = a.id;
          accountIds.push(a.id);
          break;
        }
      }
    }
    return { ok: true, txIds, billIds, accountIds };
  } catch (e) {
    // A CD we opened but could not fund would sit empty (and hide the CD move forever): close it.
    if (newCdId && !cdFunded) await api.deleteAccount(newCdId).catch((err) => console.warn("[execute] could not close empty CD", newCdId, err?.status));
    if (e instanceof NessieError) return { ok: false, error: e.message, status: e.status, retryAfter: e.retryAfter };
    return { ok: false, error: e instanceof Error ? e.message : "execution failed" };
  }
}

/** Human-readable receipt for the UI. */
export function describeOps(move: Move, ids: PersonaIds): string[] {
  return planExecution(move, ids).map((o) => {
    switch (o.op) {
      case "transfer": return `Transfer $${toDollars(o.amount_cents).toFixed(2)}: ${o.description}`;
      case "createBill": return `Recurring bill: ${o.payee} on day ${o.recurring_date}`;
      case "cancelBill": return `Cancel bill ${o.billId}`;
      case "openCd": return `Open ${o.nickname}`;
    }
  });
}
