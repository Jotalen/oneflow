/**
 * The 3 prompts shown when Ask AI opens, guessed from the account and the customer's past questions.
 * Rule-based (no model call), so they appear instantly and never invent numbers.
 */
export type Topic = "car" | "plan" | "solana" | "safety" | "other";

export interface SuggestInput {
  contract: { type: "lease" | "loan"; monthsRemaining: number } | null;
  hasCardDebt: boolean;
  safetyNetMonths: number;
  /** Previous questions, oldest first. */
  past: string[];
}

const SUGGESTION_COUNT = 3;
const LEASE_SOON_MONTHS = 6;
const THIN_SAFETY_MONTHS = 3;

const TOPIC_PATTERNS: [Topic, RegExp][] = [
  ["solana", /solana|\bsol\b|crypto|usdc/i],
  ["car", /toyota|car|lease|loan|special|dealer|corolla|camry|rav4/i],
  ["plan", /paycheck|bill|due|plan|budget|afford my/i],
  ["safety", /safety net|emergency|runway/i],
];

export function topicOf(question: string): Topic {
  return TOPIC_PATTERNS.find(([, re]) => re.test(question))?.[0] ?? "other";
}

const FOLLOW_UP: Record<Topic, string> = {
  car: "Compare the two cheapest Toyota specials for me",
  plan: "Plan my paychecks for the rest of the month again",
  solana: "What if I put 3% of each paycheck into Solana instead?",
  safety: "How fast can I get my safety net to 6 months?",
  other: "What's my next best money move?",
};

function carPrompt(c: SuggestInput["contract"]): string {
  if (c?.type === "lease" && c.monthsRemaining <= LEASE_SOON_MONTHS) return `My lease ends in ${c.monthsRemaining} months. Can I afford a new Toyota on a special?`;
  return "Which Toyota specials could I afford right now?";
}

export function suggestPrompts(input: SuggestInput): string[] {
  const last = input.past.at(-1);
  const candidates = [
    ...(last ? [FOLLOW_UP[topicOf(last)]] : []),
    ...(input.contract?.type === "lease" && input.contract.monthsRemaining <= LEASE_SOON_MONTHS ? [carPrompt(input.contract)] : []),
    ...(input.safetyNetMonths < THIN_SAFETY_MONTHS ? ["How do I build my safety net to 3 months?"] : []),
    ...(input.hasCardDebt ? ["Plan my next two paychecks around my bills"] : []),
    carPrompt(input.contract),
    "Can I put 5% of my paycheck into Solana?",
    "Plan my next two paychecks around my bills",
    "What's my next best money move?",
  ];
  const picked = candidates.reduce<string[]>((acc, q) => {
    const askedBefore = input.past.some((p) => p.toLowerCase() === q.toLowerCase());
    const sameTopic = acc.some((a) => topicOf(a) === topicOf(q) && topicOf(q) !== "other");
    return acc.length < SUGGESTION_COUNT && !askedBefore && !acc.includes(q) && !sameTopic ? [...acc, q] : acc;
  }, []);
  return picked;
}
