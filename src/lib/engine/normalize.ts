import type { ToyotaData } from "@/lib/toyota/types";
import { AS_OF, type BankAccount, type Bill, type Contract, type Debt, type NessieBundle, type Profile, type Txn } from "./types";

/** Card APR is not modeled by Nessie; synthetic by credit tier (stated in README). */
export const CARD_APR_BY_TIER: Record<string, number> = { A: 18.99, B: 22.99, C: 26.99, D: 29.99 };
const DEFAULT_CARD_APR = 24.99;
const CARD_MIN_PAYMENT_PCT = 0.02;
const CARD_MIN_PAYMENT_FLOOR = 2_500;
const SUBSCRIPTION_PAYEES = /netflix|spotify|hulu|disney|apple|t-mobile|verizon|at&t|planet fitness|gym|youtube|xbox|playstation/i;
const DEBT_PAYEES = /lender|loan|financial|bank|capital one|credit/i;
const CD_NICKNAME = /\bcd\b/i;
const VEHICLE_PAYEE = /toyota|tfs/i;

function accountKind(a: NessieBundle["accounts"][number]): BankAccount["kind"] {
  if (a.type === "Credit Card") return "card";
  if (a.type === "Savings") return CD_NICKNAME.test(a.nickname ?? "") ? "cd" : "savings";
  return "checking";
}

function toBankAccounts(b: NessieBundle): BankAccount[] {
  return b.accounts.map((a) => ({
    id: a.id,
    kind: accountKind(a),
    nickname: a.nickname ?? a.type,
    balance: a.balance_cents,
    available: a.available_cents ?? a.balance_cents,
    creditLimit: a.credit_limit_cents ?? undefined,
  }));
}

function cardDebts(accounts: BankAccount[], tier: string): Debt[] {
  return accounts
    .filter((a) => a.kind === "card" && a.balance > 0)
    .map((a) => ({
      id: a.id,
      kind: "card" as const,
      label: a.nickname,
      balance: a.balance,
      aprPct: CARD_APR_BY_TIER[tier] ?? DEFAULT_CARD_APR,
      monthlyPayment: Math.max(CARD_MIN_PAYMENT_FLOOR, Math.round(a.balance * CARD_MIN_PAYMENT_PCT)),
    }));
}

function toBills(b: NessieBundle): Bill[] {
  return b.bills.map((x) => ({
    id: x.id,
    payee: x.payee,
    nickname: x.nickname ?? undefined,
    amount: Math.round(x.payment_amount * 100),
    dueDay: x.recurring_date ?? undefined,
    status: x.status,
    isSubscription: SUBSCRIPTION_PAYEES.test(`${x.payee} ${x.nickname ?? ""}`),
    isDebtPayment: DEBT_PAYEES.test(x.payee) && !VEHICLE_PAYEE.test(x.payee),
    isVehiclePayment: VEHICLE_PAYEE.test(x.payee),
  }));
}

function toTxns(b: NessieBundle): Txn[] {
  return Object.entries(b.transactionsByAccount).flatMap(([accountId, list]) =>
    list.map((t) => ({
      id: t.id,
      accountId,
      kind: t.kind,
      status: t.status,
      amount: t.amount_cents,
      merchantId: t.merchant_id ?? undefined,
      description: t.description ?? undefined,
      createdAt: t.created_at,
    })),
  );
}

function toContract(row: ToyotaData["accounts"][number], leaseEndFees?: number | null): Contract {
  const balance = row.current_balance ?? row.payoff_quote ?? row.amount_financed;
  return {
    type: row.contract_type,
    monthsRemaining: row.months_remaining,
    termMonths: row.term_months,
    contractStart: row.contract_start,
    amountFinanced: row.amount_financed,
    monthsElapsed: row.months_elapsed,
    monthlyPayment: row.monthly_payment,
    balance,
    payoffQuote: row.payoff_quote ?? balance,
    residual: row.residual_value ?? undefined,
    mileageAllowance: row.mileage_allowance_total ?? undefined,
    estEquity: row.est_equity,
    aprPct: row.contract_type === "loan" && row.apr != null ? row.apr : undefined,
    dueDay: row.payment_due_day,
    missedPayments12m: row.missed_payments_12m,
    leaseEndFees: leaseEndFees ?? undefined,
  };
}

/** Merge Nessie bank data with Toyota CSV rows into one Profile (ADR-004: CSV owns car/contract, Nessie owns bank). */
export function buildProfile(bundle: NessieBundle, toyota: ToyotaData, personaId: string): Profile {
  const cust = toyota.customers.find((c) => c.customer_id === personaId);
  if (!cust) throw new Error(`Unknown persona ${personaId}`);
  const vehicle = toyota.vehicles.find((v) => v.customer_id === personaId);
  const contractRow = toyota.accounts.find((a) => a.customer_id === personaId);
  const situation = toyota.situations.find((s) => s.customer_id === personaId);
  const tier = cust.credit_tier_now;

  const accounts = toBankAccounts(bundle);
  const returnOption = toyota.options.find((o) => o.customer_id === personaId && o.option_id === "RETURN");
  const contract = contractRow ? toContract(contractRow, returnOption?.upfront_cost) : undefined;
  const debts: Debt[] = [...cardDebts(accounts, tier)];
  if (contract) {
    debts.unshift({
      id: contractRow!.account_id,
      kind: contract.type === "lease" ? "auto_lease" : "auto_loan",
      label: vehicle ? `${vehicle.model_year} ${vehicle.model} ${contract.type}` : `Toyota ${contract.type}`,
      balance: contract.balance,
      aprPct: contract.aprPct ?? 0,
      monthlyPayment: contract.monthlyPayment,
      monthsRemaining: contract.monthsRemaining,
      dueDay: contract.dueDay,
    });
  }

  return {
    personaId,
    name: cust.first_name,
    age: cust.age,
    asOf: AS_OF,
    incomeMonthly: Math.round(cust.annual_income / 12),
    paydayDay: cust.payday_day,
    creditTier: tier,
    accounts,
    debts,
    bills: toBills(bundle),
    recentTxns: toTxns(bundle),
    car: vehicle
      ? {
          model: vehicle.model,
          year: vehicle.model_year,
          trim: vehicle.trim,
          marketValue: vehicle.est_market_value_now,
          purchasePrice: vehicle.purchase_price_or_msrp,
          condition: vehicle.condition_at_purchase,
          odometer: vehicle.odometer_now,
          annualMilesEst: vehicle.annual_miles_est,
          toyotaCareEnds: vehicle.toyota_care_ends,
          warrantyEnds: vehicle.basic_warranty_ends,
          nextServiceDue: vehicle.next_service_due,
          openRecall: /^y/i.test(vehicle.open_recall),
        }
      : undefined,
    contract,
    carOptions: toyota.options.filter((o) => o.customer_id === personaId),
    situation: situation ? { says: situation.customer_says, summary: situation.context_summary } : undefined,
    flags: {
      vulnerable: cust.vulnerable_flag === "Y",
      missed12m: contractRow?.missed_payments_12m ?? 0,
      marketingConsent: cust.marketing_consent === "Y",
      autopay: cust.autopay === "Y",
    },
    source: "nessie",
  };
}
