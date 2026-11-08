import type { Cents } from "@/lib/money";
import { monthlyInterest } from "./amortize";
import { discretionaryMonthly, liquidTotal, recurringBills, takeHome } from "./cashflow";
import type { Contract, Debt, Profile } from "./types";

export interface ProfileOverrides {
  extraToDebtMonthly: Cents;
  /** Debt id to receive the extra ("contract" for the vehicle); default: highest-APR non-lease debt. */
  extraToDebtTargetId: string;
  incomeMonthlyDelta: Cents;
  oneTimeExpense: { month: number; amount: Cents };
  /** Replace the vehicle contract (refi, extend, buyout-as-loan). `null` drops it (return / sell / payoff). */
  contractReplacement: Contract | null;
  savingsTransferMonthly: Cents;
  cancelBillIds: string[];
  addBillsMonthly: Cents;
  /** Keep the car as an asset past lease end (buyout). Default: lease return removes the car. */
  keepCarAfterLease: boolean;
}

export interface ProjectionPoint { month: number; liquid: Cents; debt: Cents; carValue: Cents; netWorth: Cents; events: string[] }
export interface Projection { points: ProjectionPoint[]; netWorth24: Cents; feesTotal: Cents; liquidMin: Cents }

export const OVERDRAFT_FEE = 3_500;
export const CAR_DEPRECIATION_MONTHLY = 0.01;
/** After a lease return / early end, the person still needs transport: assume the same payment they have today (fallback constant without a contract). */
export const REPLACEMENT_TRANSPORT_FALLBACK = 45_000;

interface SimDebt extends Debt { kind: Debt["kind"] }

function contractToDebt(c: Contract, label: string): SimDebt {
  return {
    id: "contract",
    kind: c.type === "lease" ? "auto_lease" : "auto_loan",
    label,
    balance: c.type === "lease" ? 0 : c.balance,
    aprPct: c.aprPct ?? 0,
    monthlyPayment: c.monthlyPayment,
    monthsRemaining: c.monthsRemaining,
    dueDay: c.dueDay,
  };
}

/** Deterministic 24-month cash-flow projection (ADR-003). Pure; never touches Nessie. */
export function project(p: Profile, months = 24, overrides: Partial<ProfileOverrides> = {}): Projection {
  const o = overrides;
  const contract = o.contractReplacement === undefined ? p.contract : o.contractReplacement ?? undefined;
  const income = takeHome({ ...p, incomeMonthly: (p.incomeMonthly ?? 0) + (o.incomeMonthlyDelta ?? 0) });
  const bills = recurringBills({ ...p, bills: p.bills.filter((b) => !(o.cancelBillIds ?? []).includes(b.id)) }) + (o.addBillsMonthly ?? 0);
  const discretionary = discretionaryMonthly(p);

  const debts: SimDebt[] = p.debts.filter((d) => d.kind !== "auto_loan" && d.kind !== "auto_lease").map((d) => ({ ...d }));
  if (contract) debts.unshift(contractToDebt(contract, p.car ? `${p.car.year} ${p.car.model}` : "Toyota"));

  let liquid = liquidTotal(p);
  // A lease is rent: no asset, no principal. The car becomes an asset only under a loan (owned or bought out).
  let carValue: Cents = p.car && contract && contract.type === "loan" ? p.car.marketValue : 0;
  // Dropping a lease outright (EARLYEND / sell) means transport is needed from month 1.
  let needsTransport = !!p.car && !contract && p.contract?.type === "lease" && !o.keepCarAfterLease;
  const transport = p.contract?.type === "lease" ? p.contract.monthlyPayment : REPLACEMENT_TRANSPORT_FALLBACK;
  let feesTotal = 0;
  let liquidMin = liquid;
  const points: ProjectionPoint[] = [];
  const snapshot = (month: number, events: string[]) => {
    const debt = debts.reduce((s, d) => s + d.balance, 0);
    points.push({ month, liquid, debt, carValue, netWorth: liquid - debt + carValue, events });
  };
  snapshot(0, []);

  for (let m = 1; m <= months; m++) {
    const events: string[] = [];
    liquid += income - bills - discretionary;
    if (needsTransport) liquid -= transport;
    if (o.oneTimeExpense && o.oneTimeExpense.month === m) {
      liquid -= o.oneTimeExpense.amount;
      events.push("expense");
    }
    let extra = o.extraToDebtMonthly ?? 0;
    const byApr = [...debts].sort((a, b) => b.aprPct - a.aprPct);
    const extraTarget = (o.extraToDebtTargetId && debts.find((d) => d.id === o.extraToDebtTargetId && d.kind !== "auto_lease" && d.balance > 0)) || byApr.find((x) => x.balance > 0 && x.kind !== "auto_lease");
    for (const d of byApr) {
      if (d.kind === "auto_lease") {
        if ((d.monthsRemaining ?? 0) <= 0) continue;
        liquid -= d.monthlyPayment;
        d.monthsRemaining = (d.monthsRemaining ?? 1) - 1;
        if (d.monthsRemaining === 0) {
          events.push("lease_end");
          if (!o.keepCarAfterLease) {
            needsTransport = true;
            liquid -= contract?.leaseEndFees ?? 0;
          }
        }
        continue;
      }
      if (d.balance <= 0) continue;
      const interest = monthlyInterest(d.balance, d.aprPct);
      let pay = Math.min(d.balance + interest, d.monthlyPayment);
      if (extra > 0 && d === extraTarget) {
        const add = Math.min(extra, d.balance + interest - pay);
        pay += add;
        extra -= add;
      }
      liquid -= pay;
      d.balance = Math.max(0, d.balance + interest - pay);
      if (d.monthsRemaining !== undefined) d.monthsRemaining -= 1;
      if (d.balance === 0) events.push(d.kind === "auto_loan" ? "payoff" : "card_paid");
    }
    if (carValue > 0) carValue = Math.round(carValue * (1 - CAR_DEPRECIATION_MONTHLY));
    if (liquid < 0) {
      feesTotal += OVERDRAFT_FEE;
      liquid -= OVERDRAFT_FEE;
    }
    liquidMin = Math.min(liquidMin, liquid);
    snapshot(m, events);
  }

  return { points, netWorth24: points[points.length - 1].netWorth, feesTotal, liquidMin };
}
