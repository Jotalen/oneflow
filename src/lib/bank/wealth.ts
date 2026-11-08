/**
 * Pure helpers for the Wealth and Borrowing pages (net worth, goals, safety net, debt, credit).
 * Deterministic calcs on BankView/Profile data only; nothing here invents history.
 */
import type { Debt } from "@/lib/engine/types";
import { fmtUSD, parseCents, type Cents } from "@/lib/money";
import type { LedgerTxn, NetWorth, NetWorthPart, Point } from "./view";

const DAYS_PER_MONTH = 30;
const CARD_PAYMENT_RE = /card payment|pay card/i;

/** Net worth over the window we have: cash history shifted by the (constant) non-cash part. */
export function netWorthSeries(history: Point[], netWorth: Cents, cash: Cents): Point[] {
  const offset = netWorth - cash;
  return history.map((p) => ({ date: p.date, value: p.value + offset }));
}

export function cashChange(history: Point[]): Cents {
  if (history.length === 0) return 0;
  return history[history.length - 1].value - history[0].value;
}

/** Card payments (transfers labeled as card payments) dated in `month` ("YYYY-MM"). */
export function debtPaidInMonth(ledger: LedgerTxn[], month: string): Cents {
  return ledger
    .filter((t) => t.date.startsWith(month) && t.category === "transfer" && t.amount < 0 && CARD_PAYMENT_RE.test(t.merchant))
    .reduce((s, t) => s - t.amount, 0);
}

export type SafetyLabel = "Needs attention" | "Building" | "Okay · aim for 6" | "Strong";

export function safetyStatus(months: number): SafetyLabel {
  if (months < 1) return "Needs attention";
  if (months < 3) return "Building";
  if (months < 6) return "Okay · aim for 6";
  return "Strong";
}

/** Days the fund covers essentials if income stopped. */
export function runwayDays(fund: Cents, essentialsMonthly: Cents): number {
  if (essentialsMonthly <= 0 || fund <= 0) return 0;
  return Math.floor((fund / essentialsMonthly) * DAYS_PER_MONTH);
}

/** Payment that brings card balance strictly under `targetPct` of the limit. */
export function paymentToReachUtil(balance: Cents, limit: Cents, targetPct: number): Cents {
  if (limit <= 0) return 0;
  const maxBalance = Math.ceil((limit * targetPct) / 100) - 1;
  return Math.max(0, balance - maxBalance);
}

/** Never more than checking can cover. */
export function cappedPayment(amount: Cents, available: Cents): Cents {
  return Math.max(0, Math.min(amount, available));
}

export interface RankedDebt { debt: Debt; apr: number | null; order: number | null }

/** Debts by highest APR first. Leases have no APR and no pay order. */
export function rankDebts(debts: Debt[]): RankedDebt[] {
  const payable = debts.filter((d) => d.kind !== "auto_lease" && d.balance > 0).sort((a, b) => b.aprPct - a.aprPct);
  const leases = debts.filter((d) => d.kind === "auto_lease");
  return [
    ...payable.map((debt, i) => ({ debt, apr: debt.aprPct, order: i + 1 })),
    ...leases.map((debt) => ({ debt, apr: null, order: null })),
  ];
}

/* ---------- Net worth: per-account cash, investments slot, customer estimates ---------- */

/** A thing the customer owns that the bank can't see (home, boat, jewelry…). Value is their estimate. */
export interface OwnedAsset { id: string; name: string; value: Cents }
/** A net worth row; `estimate` marks a value the customer typed in. */
export interface OwnPart extends NetWorthPart { estimate?: boolean }
export interface NetWorthView { value: Cents; own: Cents; owe: Cents; estimates: Cents; ownParts: OwnPart[]; owePart: NetWorthPart[] }

export const MAX_ASSET_NAME = 40;
export const MAX_ASSET_VALUE: Cents = 100_000_000_000;
const CASH_DETAIL: Record<string, string> = { checking: "Checking", savings: "Savings", cd: "Certificate of deposit" };
/** Account kinds that count as investments once the bank offers them. None exist yet. */
const INVESTMENT_KINDS: ReadonlySet<string> = new Set(["investment", "brokerage", "retirement"]);

interface AccountLike { id: string; kind: string; nickname: string; balance: Cents }

/** One row per checking, savings and CD account. */
export function cashParts(accounts: readonly AccountLike[]): NetWorthPart[] {
  return accounts
    .filter((a) => a.kind in CASH_DETAIL)
    .map((a) => ({ key: `acct:${a.id}`, label: a.nickname, detail: CASH_DETAIL[a.kind], value: a.balance }));
}

/** Investment rows; empty (render nothing) when the customer has no investment account. */
export function investmentParts(accounts: readonly AccountLike[]): NetWorthPart[] {
  return accounts
    .filter((a) => INVESTMENT_KINDS.has(a.kind))
    .map((a) => ({ key: `acct:${a.id}`, label: a.nickname, detail: "Investments", value: a.balance }));
}

/** The bank's net worth with cash split per account, investments, and the customer's own estimates added. */
export function netWorthWithExtras(base: NetWorth, accounts: readonly AccountLike[], assets: readonly OwnedAsset[]): NetWorthView {
  const estimateParts: OwnPart[] = assets.map((a) => ({ key: `asset:${a.id}`, label: a.name, detail: "Your estimate", value: a.value, estimate: true }));
  const ownParts: OwnPart[] = [
    ...cashParts(accounts),
    ...base.ownParts.filter((p) => p.key !== "cash"),
    ...investmentParts(accounts),
    ...estimateParts,
  ];
  const own = ownParts.reduce((s, p) => s + p.value, 0);
  const estimates = estimateParts.reduce((s, p) => s + p.value, 0);
  return { value: own - base.owe, own, owe: base.owe, estimates, ownParts, owePart: base.owePart };
}

export type AssetCheck = { ok: true; name: string; value: Cents } | { ok: false; error: string };

export function validateAsset(nameText: string, valueText: string): AssetCheck {
  const name = nameText.trim();
  if (!name || name.length > MAX_ASSET_NAME) return { ok: false, error: `Name is required (up to ${MAX_ASSET_NAME} characters)` };
  const value = parseCents(valueText);
  if (value === null || value <= 0) return { ok: false, error: "Enter a value above $0" };
  if (value > MAX_ASSET_VALUE) return { ok: false, error: `Enter a value up to ${fmtUSD(MAX_ASSET_VALUE)}` };
  return { ok: true, name, value };
}

const isCentsIn = (v: unknown, max: Cents, min: Cents): v is Cents => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** Storage is untrusted: keep only well-formed assets. */
export function parseOwnedAssets(raw: string | null): OwnedAsset[] {
  if (!raw) return [];
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(data)) return [];
  return data.flatMap((x): OwnedAsset[] => {
    if (!x || typeof x !== "object") return [];
    const { id, name, value } = x as Record<string, unknown>;
    if (typeof id !== "string" || typeof name !== "string" || !name.trim() || name.length > MAX_ASSET_NAME) return [];
    return isCentsIn(value, MAX_ASSET_VALUE, 1) ? [{ id, name, value }] : [];
  });
}

/* ---------- Safety net: adjustable essentials and runway ---------- */

export const MAX_ESSENTIAL: Cents = 5_000_000;
const FIXED_ESSENTIAL_RE = /car payment|car lease|debt|loan|rent|mortgage/i;

export interface EssentialItem { key: string; label: string; value: Cents; estimate: Cents; fixed: boolean; adjusted: boolean }
export type EssentialOverrides = Readonly<Record<string, Cents>>;

/** Fixed bills (car, loans, rent, debt payments) can't be trimmed in an emergency, so they stay locked. */
export const isFixedEssential = (label: string): boolean => FIXED_ESSENTIAL_RE.test(label);
export const essentialKey = (label: string): string => label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Applies the customer's amounts to flexible rows only; fixed rows always use the bank's figure. */
export function applyEssentialOverrides(essentials: readonly { label: string; value: Cents }[], overrides: EssentialOverrides): EssentialItem[] {
  return essentials.map((e) => {
    const key = essentialKey(e.label);
    const fixed = isFixedEssential(e.label);
    const own = fixed ? undefined : overrides[key];
    const value = own ?? e.value;
    return { key, label: e.label, value, estimate: e.value, fixed, adjusted: value !== e.value };
  });
}

export const essentialsTotal = (items: readonly { value: Cents }[]): Cents => items.reduce((s, e) => s + e.value, 0);

export function parseEssentialOverrides(raw: string | null): Record<string, Cents> {
  if (!raw) return {};
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return {}; }
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  return Object.fromEntries(Object.entries(data as Record<string, unknown>).filter(([, v]) => isCentsIn(v, MAX_ESSENTIAL, 0))) as Record<string, Cents>;
}

/** Months (one decimal) and whole days cash covers essentials; null when there are no essentials. */
export function runway(fund: Cents, essentialsMonthly: Cents): { months: number; days: number } | null {
  if (essentialsMonthly <= 0) return null;
  if (fund <= 0) return { months: 0, days: 0 };
  return { months: Math.round((fund * 10) / essentialsMonthly) / 10, days: Math.floor((fund * DAYS_PER_MONTH) / essentialsMonthly) };
}
