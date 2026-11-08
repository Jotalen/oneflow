import { fmtUSD, type Cents } from "@/lib/money";
import { project, type Projection, type ProfileOverrides } from "@/lib/engine/project";
import { health, SHOCK_THRESHOLD, type HealthReport } from "@/lib/engine/health";
import { AS_OF, type Bill, type Profile } from "@/lib/engine/types";

/**
 * What-if simulator: maps slider state to `project()` overrides and reads the result back.
 * Every number comes from the deterministic engine; this module only selects, compares and words it.
 */
export const HORIZON_MONTHS = 24;
export const CONTRACT_DEBT_ID = "contract";
const NEW_BILL_ID = "whatif-new-bill";

export interface Scenario {
  /** Signed: negative is a pay cut or job loss. Gross monthly income, like `Profile.incomeMonthly`. */
  incomeMonthlyDelta: Cents;
  expenseAmount: Cents;
  /** 1..24: months from today. */
  expenseMonth: number;
  extraToDebtMonthly: Cents;
  /** null: the engine's default (highest-APR debt with a balance). */
  extraToDebtTargetId: string | null;
  cancelBillIds: readonly string[];
  newBillMonthly: Cents;
}

export const EMPTY_SCENARIO: Scenario = {
  incomeMonthlyDelta: 0, expenseAmount: 0, expenseMonth: 1, extraToDebtMonthly: 0,
  extraToDebtTargetId: null, cancelBillIds: [], newBillMonthly: 0,
};

export interface DebtTarget { id: string; label: string; balance: Cents; aprPct: number }
export interface CancellableBill { id: string; label: string; amount: Cents; isSubscription: boolean }

/** Debts an extra payment can go to, in the engine's ids (the vehicle loan is "contract"). Leases have no principal. */
export function debtTargets(p: Profile): DebtTarget[] {
  const others = p.debts
    .filter((d) => d.kind !== "auto_loan" && d.kind !== "auto_lease" && d.balance > 0)
    .map((d) => ({ id: d.id, label: d.label, balance: d.balance, aprPct: d.aprPct }));
  const c = p.contract;
  const loanLabel = p.debts.find((d) => d.kind === "auto_loan")?.label ?? (p.car ? `${p.car.year} ${p.car.model} loan` : "Car loan");
  const car = c && c.type === "loan" && c.balance > 0 ? [{ id: CONTRACT_DEBT_ID, label: loanLabel, balance: c.balance, aprPct: c.aprPct ?? 0 }] : [];
  return [...others, ...car].sort((a, b) => b.aprPct - a.aprPct);
}

/** Real recurring bills that can be cancelled: not loan payments and not the car autopay. */
export function cancellableBills(p: Profile): CancellableBill[] {
  return p.bills
    .filter((b) => b.status === "recurring" && !b.isDebtPayment && !b.isVehiclePayment)
    .map((b) => ({ id: b.id, label: b.nickname ?? b.payee, amount: b.amount, isSubscription: b.isSubscription }));
}

const clampInt = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(n) ? n : lo)));

/** Validated scenario: unknown ids dropped, amounts non-negative, income loss capped at the whole income. */
function normalize(p: Profile, s: Scenario): Scenario {
  const billIds = new Set(cancellableBills(p).map((b) => b.id));
  const targets = debtTargets(p);
  const income = p.incomeMonthly ?? 0;
  return {
    incomeMonthlyDelta: Math.max(-income, Math.round(s.incomeMonthlyDelta) || 0),
    expenseAmount: Math.max(0, Math.round(s.expenseAmount) || 0),
    expenseMonth: clampInt(s.expenseMonth, 1, HORIZON_MONTHS),
    extraToDebtMonthly: targets.length ? Math.max(0, Math.round(s.extraToDebtMonthly) || 0) : 0,
    extraToDebtTargetId: targets.some((t) => t.id === s.extraToDebtTargetId) ? s.extraToDebtTargetId : null,
    cancelBillIds: [...new Set(s.cancelBillIds)].filter((id) => billIds.has(id)),
    newBillMonthly: Math.max(0, Math.round(s.newBillMonthly) || 0),
  };
}

export function isEmptyScenario(s: Scenario): boolean {
  return !s.incomeMonthlyDelta && !s.expenseAmount && !s.extraToDebtMonthly && !s.cancelBillIds.length && !s.newBillMonthly;
}

/** Scenario → `project()` overrides. Zero sliders produce no override, so an empty scenario is the do-nothing future. */
export function scenarioToOverrides(p: Profile, raw: Scenario): Partial<ProfileOverrides> {
  const s = normalize(p, raw);
  return {
    ...(s.incomeMonthlyDelta ? { incomeMonthlyDelta: s.incomeMonthlyDelta } : {}),
    ...(s.expenseAmount ? { oneTimeExpense: { month: s.expenseMonth, amount: s.expenseAmount } } : {}),
    ...(s.extraToDebtMonthly ? { extraToDebtMonthly: s.extraToDebtMonthly } : {}),
    ...(s.extraToDebtMonthly && s.extraToDebtTargetId ? { extraToDebtTargetId: s.extraToDebtTargetId } : {}),
    ...(s.cancelBillIds.length ? { cancelBillIds: [...s.cancelBillIds] } : {}),
    ...(s.newBillMonthly ? { addBillsMonthly: s.newBillMonthly } : {}),
  };
}

export interface CashLow { month: number; liquid: Cents }

export function cashLow(pr: Projection): CashLow {
  return pr.points.reduce<CashLow>((low, pt) => (pt.liquid < low.liquid ? { month: pt.month, liquid: pt.liquid } : low), { month: 0, liquid: pr.points[0].liquid });
}

/** First month cash goes below zero, or null if it never does within the projection. */
export function runOutMonth(pr: Projection): number | null {
  return pr.points.find((pt) => pt.month > 0 && pt.liquid < 0)?.month ?? null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Projection month → calendar month, counted from the as-of date (month 1 = next month). */
export function monthLabel(month: number): string {
  const [y, m] = AS_OF.split("-").map(Number);
  const idx = m - 1 + month;
  return `${MONTHS[idx % 12]} ${y + Math.floor(idx / 12)}`;
}

export interface ChartRow { month: number; baseNetWorth: number; scenNetWorth: number; baseCash: number; scenCash: number }

/** Dollars (not cents) for the chart axes. */
export function chartRows(base: Projection, scen: Projection): ChartRow[] {
  return base.points.map((pt, i) => ({
    month: pt.month,
    baseNetWorth: pt.netWorth / 100, scenNetWorth: scen.points[i].netWorth / 100,
    baseCash: pt.liquid / 100, scenCash: scen.points[i].liquid / 100,
  }));
}

/**
 * Health indicators at a projected month: cash is the projection's liquid balance, monthly flows include the scenario.
 * Card and loan balances stay at today's values (the projection tracks total debt, not each account).
 */
export function healthAtMonth(p: Profile, raw: Scenario, pr: Projection, month: number): HealthReport {
  const s = normalize(p, raw);
  const liquid = pr.points[Math.min(month, pr.points.length - 1)].liquid;
  const cancelled = new Set(s.cancelBillIds);
  const newBill: Bill[] = s.newBillMonthly
    ? [{ id: NEW_BILL_ID, payee: "New monthly bill", amount: s.newBillMonthly, status: "recurring", isSubscription: false, isDebtPayment: false, isVehiclePayment: false }]
    : [];
  const projected: Profile = {
    ...p,
    incomeMonthly: (p.incomeMonthly ?? 0) + s.incomeMonthlyDelta,
    accounts: [
      { id: "projected-cash", kind: "checking", nickname: "Projected cash", balance: liquid, available: liquid },
      ...p.accounts.filter((a) => a.kind === "card"),
    ],
    bills: [...p.bills.filter((b) => !cancelled.has(b.id)), ...newBill],
  };
  return health(projected);
}

export type Direction = "better" | "worse" | "same";
export interface IndicatorChange { key: keyof HealthReport; label: string; base: string; scenario: string; direction: Direction }

interface IndicatorDef {
  key: "runwayMonths" | "savingsRatePct" | "dtiPct" | "ptiPct" | "subscriptionBurdenPct";
  label: string;
  higherIsBetter: boolean;
  unit: "mo" | "%";
  /** A share of income: undefined (not 0%) when income is zero. */
  perIncome: boolean;
}
const NUMERIC: IndicatorDef[] = [
  { key: "runwayMonths", label: "Cash runway", higherIsBetter: true, unit: "mo", perIncome: false },
  { key: "savingsRatePct", label: "Savings rate", higherIsBetter: true, unit: "%", perIncome: true },
  { key: "dtiPct", label: "Debt-to-income", higherIsBetter: false, unit: "%", perIncome: true },
  { key: "ptiPct", label: "Car payment-to-income", higherIsBetter: false, unit: "%", perIncome: true },
  { key: "subscriptionBurdenPct", label: "Subscriptions share of income", higherIsBetter: false, unit: "%", perIncome: true },
];
const NO_INCOME = "No income";

const round1 = (n: number) => Math.round(n * 10) / 10;
const fmtIndicator = (n: number, unit: "mo" | "%") => (unit === "mo" ? `${round1(n)} mo` : `${round1(n)}%`);

function direction(base: number, scen: number, higherIsBetter: boolean): Direction {
  const diff = round1(scen) - round1(base);
  if (diff === 0) return "same";
  return diff > 0 === higherIsBetter ? "better" : "worse";
}

export interface IndicatorContext { hasContract: boolean; baseIncome: Cents; scenarioIncome: Cents }

function numericChange(d: IndicatorDef, base: HealthReport, scen: HealthReport, ctx: IndicatorContext): IndicatorChange {
  const baseNone = d.perIncome && ctx.baseIncome <= 0;
  const scenNone = d.perIncome && ctx.scenarioIncome <= 0;
  const incomeDir: Direction = baseNone === scenNone ? "same" : scenNone ? "worse" : "better";
  return {
    key: d.key, label: d.label,
    direction: baseNone || scenNone ? incomeDir : direction(base[d.key], scen[d.key], d.higherIsBetter),
    base: baseNone ? NO_INCOME : fmtIndicator(base[d.key], d.unit),
    scenario: scenNone ? NO_INCOME : fmtIndicator(scen[d.key], d.unit),
  };
}

/** Indicators the scenario can move, compared side by side. Utilization and car equity are held at today's balances, so they are left out. */
export function indicatorChanges(base: HealthReport, scen: HealthReport, ctx: IndicatorContext): IndicatorChange[] {
  const numeric = NUMERIC.filter((d) => ctx.hasContract || d.key !== "ptiPct").map((d) => numericChange(d, base, scen, ctx));
  const shock: IndicatorChange = {
    key: "shockResilient", label: `Covers a ${fmtWhole(SHOCK_THRESHOLD)} surprise`,
    base: base.shockResilient ? "Yes" : "No", scenario: scen.shockResilient ? "Yes" : "No",
    direction: base.shockResilient === scen.shockResilient ? "same" : scen.shockResilient ? "better" : "worse",
  };
  return [...numeric, shock];
}

/** Whole dollars: $1,000. */
export const fmtWhole = (c: Cents): string => fmtUSD(Math.round(c / 100) * 100).replace(/\.00$/, "");

const joinWords = (parts: string[]) => (parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`);

/** Each active change in plain words ("lose $1,000/mo of income"). */
export function describeScenario(p: Profile, raw: Scenario): string[] {
  const s = normalize(p, raw);
  const targets = debtTargets(p);
  const target = targets.find((t) => t.id === s.extraToDebtTargetId) ?? targets[0];
  const bills = cancellableBills(p);
  const cancelled = s.cancelBillIds.map((id) => bills.find((b) => b.id === id)?.label ?? id);
  return [
    s.incomeMonthlyDelta < 0 ? `lose ${fmtWhole(-s.incomeMonthlyDelta)}/mo of income` : "",
    s.incomeMonthlyDelta > 0 ? `earn ${fmtWhole(s.incomeMonthlyDelta)}/mo more` : "",
    s.expenseAmount ? `pay a one-time ${fmtWhole(s.expenseAmount)} in month ${s.expenseMonth}` : "",
    s.extraToDebtMonthly && target ? `put an extra ${fmtWhole(s.extraToDebtMonthly)}/mo toward your ${target.label}` : "",
    cancelled.length ? `cancel ${joinWords(cancelled)}` : "",
    s.newBillMonthly ? `add a new ${fmtWhole(s.newBillMonthly)}/mo bill` : "",
  ].filter(Boolean);
}

interface Pair<T> { baseline: T; scenario: T }
export interface WhatIfResult {
  baseline: Projection;
  scenario: Projection;
  netWorthDelta24: Cents;
  cashDelta24: Cents;
  low: Pair<CashLow>;
  runOut: Pair<number | null>;
  fees: Pair<Cents>;
  health: Pair<HealthReport>;
  changes: IndicatorChange[];
  summary: string;
}

const whenMonth = (m: number) => (m === 0 ? "today" : `in month ${m} (${monthLabel(m)})`);

function doNothingSummary(low: CashLow, runOut: number | null): string {
  if (runOut !== null) return `Doing nothing, you run out of cash ${whenMonth(runOut)}.`;
  return `Doing nothing, your cash stays above zero for all ${HORIZON_MONTHS} months; its lowest point is ${fmtWhole(low.liquid)} ${whenMonth(low.month)}.`;
}

function scenarioSummary(parts: string[], r: Omit<WhatIfResult, "summary" | "changes" | "health">): string {
  const lead = `If you ${joinWords(parts)}`;
  const fees = r.fees.scenario > 0 ? ` Overdraft fees: ${fmtWhole(r.fees.scenario)}.` : "";
  const base = r.runOut.baseline;
  const scen = r.runOut.scenario;
  if (scen !== null) {
    if (base === null) return `${lead}, you run out of cash ${whenMonth(scen)}.${fees}`;
    const vs = scen === base ? "the same month as doing nothing" : scen < base ? `${base - scen} months sooner than doing nothing` : `${scen - base} months later than doing nothing`;
    return `${lead}, you run out of cash ${whenMonth(scen)}, ${vs}.${fees}`;
  }
  const d = r.netWorthDelta24;
  const nw = d === 0 ? "the same as doing nothing" : `${fmtWhole(Math.abs(d))} ${d > 0 ? "higher" : "lower"} than doing nothing`;
  const rescue = base !== null ? " You no longer run out of cash." : "";
  return `${lead}, your net worth in ${HORIZON_MONTHS} months is ${nw}.${rescue} Cash bottoms out at ${fmtWhole(r.low.scenario.liquid)} ${whenMonth(r.low.scenario.month)}.${fees}`;
}

/** Baseline vs scenario over 24 months, with the readouts the page shows. */
export function runWhatIf(p: Profile, s: Scenario): WhatIfResult {
  const baseline = project(p, HORIZON_MONTHS);
  const scenario = project(p, HORIZON_MONTHS, scenarioToOverrides(p, s));
  const last = HORIZON_MONTHS;
  const core = {
    baseline, scenario,
    netWorthDelta24: scenario.netWorth24 - baseline.netWorth24,
    cashDelta24: scenario.points[last].liquid - baseline.points[last].liquid,
    low: { baseline: cashLow(baseline), scenario: cashLow(scenario) },
    runOut: { baseline: runOutMonth(baseline), scenario: runOutMonth(scenario) },
    fees: { baseline: baseline.feesTotal, scenario: scenario.feesTotal },
  };
  const h = { baseline: healthAtMonth(p, EMPTY_SCENARIO, baseline, last), scenario: healthAtMonth(p, s, scenario, last) };
  const income = p.incomeMonthly ?? 0;
  const ctx = { hasContract: !!p.contract, baseIncome: income, scenarioIncome: income + normalize(p, s).incomeMonthlyDelta };
  const parts = describeScenario(p, s);
  const summary = parts.length ? scenarioSummary(parts, core) : doNothingSummary(core.low.baseline, core.runOut.baseline);
  return { ...core, health: h, changes: indicatorChanges(h.baseline, h.scenario, ctx), summary };
}
