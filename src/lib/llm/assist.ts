/**
 * "Ask AI" answers for the safety net and "which card" (ADR-003: code computes, the model phrases).
 * Every number is computed here first; the offline answer is built from the same facts, and a model
 * answer that contains any number not in those facts is thrown away in favour of the offline one.
 */
import type { Analysis } from "@/lib/engine/analyze";
import type { BankAccount } from "@/lib/engine/types";
import { fmtUSD, type Cents } from "@/lib/money";
import { addMonths, buildBankView, monthsToTarget, REWARD_RATE, type Category } from "@/lib/bank/view";
import { applyEssentialOverrides, essentialsTotal, runway, type EssentialItem, type EssentialOverrides } from "@/lib/bank/wealth";
import type { LlmProvider, Msg } from "./provider";

export type AssistTopic = "safety_net" | "which_card";
export type AssistSource = "gemini" | "openrouter" | "offline";
export interface AssistAnswer { text: string; source: AssistSource }

export const SAFETY_LEAD = "To make your money last longer in case of emergencies, follow these steps:";
export const CARD_LEAD = "Based on the type of purchase you should use";

const TRIM_PCT = 20;
const SAVE_MONTHLY: Cents = 15_000;
const UTIL_WARN_PCT = 30;
const PER_HUNDRED: Cents = 10_000;
const PHONE_RE = /mobile|wireless|phone|verizon|at&t|sprint/i;
const SUBSCRIPTIONS_RE = /subscri/i;

type Runway = { months: number; days: number } | null;

const fmtMonthYear = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
/** "a", "a and b", "a, b and c" */
const listOf = (xs: readonly string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/* ---------------- Safety net ---------------- */

export interface SafetyFacts {
  name: string;
  cash: Cents;
  cdBalance: Cents;
  essentialsMonthly: Cents;
  fixed: EssentialItem[];
  flexible: EssentialItem[];
  runway: Runway;
  goalMonths: number;
  goalTarget: Cents;
  gap: Cents;
  pausable: { name: string; amount: Cents }[];
  pausableMonthly: Cents;
  ifPaused: Runway;
  trimPct: number;
  trimLabels: string[];
  trimMonthly: Cents;
  ifTrimmed: Runway;
  card: { name: string; aprPct: number; balance: Cents; minimum: Cents } | null;
  saveMonthly: Cents;
  goalDateAtSave: string | null;
}

function cardDebt(a: Analysis, card: BankAccount | undefined) {
  const debts = a.profile.debts.filter((d) => d.kind === "card");
  return debts.find((d) => d.label === card?.nickname) ?? debts[0];
}

export function safetyFacts(a: Analysis, overrides: EssentialOverrides): SafetyFacts {
  const p = a.profile;
  const sn = buildBankView(a).safetyNet;
  const items = applyEssentialOverrides(sn.essentials, overrides);
  const essentialsMonthly = essentialsTotal(items);
  const flexible = items.filter((e) => !e.fixed);
  const pausable = p.bills
    .filter((b) => b.isSubscription && b.status === "recurring" && !PHONE_RE.test(`${b.payee} ${b.nickname ?? ""}`))
    .map((b) => ({ name: b.nickname ?? b.payee, amount: b.amount }));
  const subsItem = flexible.find((e) => SUBSCRIPTIONS_RE.test(e.label));
  const pausableMonthly = pausable.reduce((s, x) => s + x.amount, 0);
  const pauseCut = Math.min(pausableMonthly, subsItem?.value ?? 0);
  const trimmable = flexible.filter((e) => !SUBSCRIPTIONS_RE.test(e.label) && e.value > 0);
  const trimMonthly = trimmable.reduce((s, e) => s + Math.round((e.value * TRIM_PCT) / 100), 0);
  const goalTarget = essentialsMonthly * sn.goalMonths;
  const months = monthsToTarget(sn.fund, goalTarget, SAVE_MONTHLY);
  const cardAcct = p.accounts.find((x) => x.kind === "card");
  const debt = cardDebt(a, cardAcct);
  return {
    name: p.name,
    cash: sn.fund,
    cdBalance: p.accounts.filter((x) => x.kind === "cd").reduce((s, x) => s + x.balance, 0),
    essentialsMonthly,
    fixed: items.filter((e) => e.fixed),
    flexible,
    runway: runway(sn.fund, essentialsMonthly),
    goalMonths: sn.goalMonths,
    goalTarget,
    gap: Math.max(0, goalTarget - sn.fund),
    pausable,
    pausableMonthly: pauseCut,
    ifPaused: pauseCut > 0 ? runway(sn.fund, essentialsMonthly - pauseCut) : null,
    trimPct: TRIM_PCT,
    trimLabels: trimmable.map((e) => e.label.toLowerCase()),
    trimMonthly,
    ifTrimmed: trimMonthly > 0 ? runway(sn.fund, essentialsMonthly - trimMonthly) : null,
    card: cardAcct && debt ? { name: cardAcct.nickname, aprPct: debt.aprPct, balance: cardAcct.balance, minimum: debt.monthlyPayment } : null,
    saveMonthly: SAVE_MONTHLY,
    goalDateAtSave: Number.isFinite(months) ? addMonths(p.asOf, months) : null,
  };
}

export function safetySteps(f: SafetyFacts): string[] {
  const steps: string[] = [];
  const days = f.runway?.days;
  if (f.ifPaused && days !== undefined) {
    steps.push(`Pause ${listOf(f.pausable.map((x) => x.name))} while money is tight. That frees ${fmtUSD(f.pausableMonthly)} a month and stretches your cash from ${days} to ${f.ifPaused.days} days.`);
  }
  if (f.ifTrimmed && days !== undefined) {
    steps.push(`Spend ${f.trimPct}% less on ${listOf(f.trimLabels)}. That's ${fmtUSD(f.trimMonthly)} less a month and gets you to ${f.ifTrimmed.days} days.`);
  }
  if (f.fixed.length) {
    steps.push(`Pay your fixed bills first: ${listOf(f.fixed.map((e) => `${e.label.toLowerCase()} ${fmtUSD(e.value)}`))}. If your income stops, call the lender before you miss a payment and ask about a hardship option.`);
  }
  if (f.card) {
    steps.push(`Try not to put everyday costs on your ${f.card.name}: it charges ${f.card.aprPct}% APR. Keep paying at least the ${fmtUSD(f.card.minimum)} minimum so you avoid late fees.`);
  }
  if (f.gap > 0 && f.goalDateAtSave) {
    steps.push(`Move ${fmtUSD(f.saveMonthly)} a month into savings to reach ${f.goalMonths} months of essentials (${fmtUSD(f.goalTarget)}) by ${fmtMonthYear(f.goalDateAtSave)}.`);
  } else if (f.gap === 0) {
    steps.push(`You already cover ${f.goalMonths} months of essentials. Leave that money in savings so it's there when you need it.`);
  }
  if (f.cdBalance > 0) {
    steps.push(`Use checking and savings first. Your CD (${fmtUSD(f.cdBalance)}) counts in this cash, but taking it out early can cost a penalty.`);
  }
  return steps;
}

function safetyNow(f: SafetyFacts): string {
  if (!f.runway) return `Right now you have ${fmtUSD(f.cash)} in cash and no monthly essentials entered.`;
  return `Right now your cash (${fmtUSD(f.cash)}) covers ${f.runway.months.toFixed(1)} months, about ${f.runway.days} days, of essentials at ${fmtUSD(f.essentialsMonthly)} a month.`;
}

export function offlineSafety(f: SafetyFacts): string {
  return [SAFETY_LEAD, ...safetySteps(f).map((s, i) => `${i + 1}. ${s}`), safetyNow(f)].join("\n");
}

/* ---------------- Which card ---------------- */

export type PurchaseKind = "groceries" | "gas" | "dining" | "travel" | "online" | "big" | "other";

export const PURCHASE_CHIPS: readonly { kind: PurchaseKind; label: string }[] = [
  { kind: "groceries", label: "Groceries" }, { kind: "gas", label: "Gas" }, { kind: "dining", label: "Dining" },
  { kind: "travel", label: "Travel" }, { kind: "online", label: "Online shopping" }, { kind: "big", label: "A big purchase" },
];

const PURCHASE_RULES: readonly [PurchaseKind, RegExp][] = [
  ["groceries", /grocer|supermarket|tom thumb|kroger|h-?e-?b|whole foods|trader joe|costco|food shopping/i],
  ["gas", /\bgas\b|fuel|fill(ing)? up|tank|quiktrip|shell|exxon|chevron|\bev charg/i],
  ["dining", /dinner|lunch|breakfast|brunch|dining|restaurant|eat(ing)? out|coffee|starbucks|takeout|take-out|food delivery|doordash|uber eats|tacos|pizza|\bbar\b/i],
  ["travel", /travel|flight|airline|plane|hotel|airbnb|trip|vacation|rental car|cruise/i],
  ["online", /online|amazon|e-?commerce|website|internet order/i],
  ["big", /big purchase|large purchase|laptop|computer|tv|television|furniture|appliance|sofa|couch|mattress|phone upgrade|repair/i],
];

const KIND_CATEGORY: Record<PurchaseKind, Category> = {
  groceries: "groceries", gas: "gas", dining: "dining", travel: "transport", online: "shopping", big: "shopping", other: "shopping",
};
const KIND_LABEL: Record<PurchaseKind, string> = {
  groceries: "groceries", gas: "gas", dining: "dining", travel: "travel", online: "online shopping", big: "big purchases", other: "everyday purchases",
};

export function classifyPurchase(question: string): PurchaseKind {
  return PURCHASE_RULES.find(([, re]) => re.test(question))?.[0] ?? "other";
}

const AMOUNT_RE = /\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(\.\d{1,2})?/;

/** First dollar amount in the question, in cents. */
export function parseAmount(question: string): Cents | null {
  const m = AMOUNT_RE.exec(question);
  if (!m) return null;
  const cents = Math.round(Number(`${m[1].replace(/,/g, "")}${m[2] ?? ""}`) * 100);
  return Number.isFinite(cents) && cents > 0 ? cents : null;
}

export interface CardFacts { name: string; aprPct: number | null; balance: Cents; limit: Cents; available: Cents; rate: number }
export interface WhichCardFacts {
  name: string;
  purchase: PurchaseKind;
  purchaseLabel: string;
  amount: Cents | null;
  checkingName: string;
  cards: CardFacts[];
  best: CardFacts | null;
  fitsAvailable: boolean | null;
  utilAfterPct: number | null;
}
/** Per-card rewards rates by category; the bank has one rewards program today (view.ts REWARD_RATE). */
export type CardRates = Readonly<Record<string, Partial<Record<Category, number>>>>;

export function whichCardFacts(a: Analysis, question: string, cardRates: CardRates = {}): WhichCardFacts {
  const p = a.profile;
  const purchase = classifyPurchase(question);
  const category = KIND_CATEGORY[purchase];
  const amount = parseAmount(question);
  const cards = p.accounts
    .filter((x) => x.kind === "card")
    .map((c): CardFacts => {
      const limit = c.creditLimit ?? 0;
      const rates = cardRates[c.nickname] ?? REWARD_RATE;
      return { name: c.nickname, aprPct: cardDebt(a, c)?.aprPct ?? null, balance: c.balance, limit, available: Math.max(0, limit - c.balance), rate: rates[category] ?? 1 };
    })
    .sort((x, y) => y.rate - x.rate || (x.aprPct ?? Infinity) - (y.aprPct ?? Infinity));
  const best = cards[0] ?? null;
  const fitsAvailable = best && amount !== null ? amount <= best.available : null;
  const utilAfterPct = best && amount !== null && fitsAvailable && best.limit > 0 ? Math.round(((best.balance + amount) / best.limit) * 100) : null;
  return {
    name: p.name, purchase, purchaseLabel: KIND_LABEL[purchase], amount,
    checkingName: p.accounts.find((x) => x.kind === "checking")?.nickname ?? "checking",
    cards, best, fitsAvailable, utilAfterPct,
  };
}

function cardAmountLine(f: WhichCardFacts, best: CardFacts): string | null {
  if (f.amount === null) return null;
  if (f.fitsAvailable === false) return `But ${fmtUSD(f.amount)} is more than the ${fmtUSD(best.available)} you have available on it, so pay from ${f.checkingName} or split the purchase.`;
  if (f.utilAfterPct === null) return null;
  const warn = f.utilAfterPct > UTIL_WARN_PCT ? ` Above ${UTIL_WARN_PCT}% can lower your credit score, so pay it down soon.` : "";
  return `A ${fmtUSD(f.amount)} purchase would put the card at ${f.utilAfterPct}% of its ${fmtUSD(best.limit)} limit.${warn}`;
}

export function offlineWhichCard(f: WhichCardFacts): string {
  const best = f.best;
  if (!best) {
    return `${CARD_LEAD} your debit card from ${f.checkingName}, because you don't have a OneFlow card yet. Debit doesn't earn points, but it doesn't charge interest either.`;
  }
  const others = f.cards.slice(1);
  const vs = others.length ? `, versus ${listOf(others.map((c) => `${c.rate}x on your ${c.name}`))}` : "";
  const lines = [
    `${CARD_LEAD} your ${best.name}, because it earns ${best.rate}x points on ${f.purchaseLabel}, about ${fmtUSD(best.rate * 100)} back for every ${fmtUSD(PER_HUNDRED).replace(".00", "")} you spend${vs}.`,
    others.length ? null : "It's the only card you have with us, so there's nothing to compare it against.",
    cardAmountLine(f, best),
    best.aprPct !== null
      ? `Pay the full statement balance each month: ${best.balance > 0 ? `you carry ${fmtUSD(best.balance)} on it now, and ` : ""}anything left over costs ${best.aprPct}% APR.`
      : null,
  ];
  return lines.filter((l): l is string => !!l).join(" ");
}

/* ---------------- Model phrasing with a numbers guard ---------------- */

const NUMBER_RE = /\d[\d,]*(?:\.\d+)?/g;
const ALWAYS_OK_MAX = 10;
const numbersIn = (s: string) => (s.match(NUMBER_RE) ?? []).map((t) => Number(t.replace(/,/g, ""))).filter(Number.isFinite);

/** True when every number in `text` also appears in `facts` (small list numbers are always fine). */
export function onlyKnownNumbers(text: string, facts: string): boolean {
  const known = new Set(numbersIn(facts));
  return numbersIn(text).every((n) => n <= ALWAYS_OK_MAX || known.has(n));
}

const RULES = [
  "You are OneFlow's money assistant. Rewrite the FACTS for this customer in plain, friendly English.",
  "Never do arithmetic. Every number you write must appear exactly as it does in FACTS. Do not add numbers, percentages, dates, products or advice that are not in FACTS.",
  "Plain text only: no markdown, no headings, no bold.",
];

function promptFor(topic: AssistTopic, facts: string, question?: string): Msg[] {
  const shape = topic === "safety_net"
    ? `Start with exactly: "${SAFETY_LEAD}" Then the steps as a numbered list in the same order, one or two short sentences each. End with the line about where they are now.`
    : `Start with exactly: "${CARD_LEAD}" Then two to four short sentences.`;
  const user = topic === "which_card" && question ? `FACTS:\n${facts}\n\nWhat the customer is about to buy: ${question}` : `FACTS:\n${facts}`;
  return [{ role: "system", content: [...RULES, shape].join("\n") }, { role: "user", content: user }];
}

function tidy(text: string, lead: string): string {
  const clean = text.replace(/\*\*|__|^#+\s*/gm, "").trim();
  return clean.startsWith(lead) ? clean : `${lead} ${clean}`;
}

export interface AssistInput { analysis: Analysis; topic: AssistTopic; question?: string; overrides?: EssentialOverrides }

function offlineFor(input: AssistInput): { text: string; lead: string } {
  if (input.topic === "safety_net") return { text: offlineSafety(safetyFacts(input.analysis, input.overrides ?? {})), lead: SAFETY_LEAD };
  return { text: offlineWhichCard(whichCardFacts(input.analysis, input.question ?? "")), lead: CARD_LEAD };
}

/** Tries each real model in order; any failure or invented number falls through to the offline answer. */
export async function answerAssist(input: AssistInput, chain: readonly LlmProvider[]): Promise<AssistAnswer> {
  const offline = offlineFor(input);
  const messages = promptFor(input.topic, offline.text, input.question);
  for (const provider of chain) {
    if (provider.name === "stub") continue;
    try {
      const turn = await provider.chat(messages, []);
      const text = turn.text ? tidy(turn.text, offline.lead) : "";
      if (text && onlyKnownNumbers(text, offline.text)) return { text, source: provider.name };
      console.warn(`[assist] ${provider.name} answer rejected: ${text ? "number not in facts" : "empty"}`);
    } catch (e) {
      console.warn(`[assist] ${provider.name} failed:`, e instanceof Error ? e.message.slice(0, 160) : e);
    }
  }
  return { text: offline.text, source: "offline" };
}
