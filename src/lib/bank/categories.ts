/**
 * Spending categories for OneFlow: one fixed set of 16 (alphabetical), plus "income" and "transfer"
 * for money that is not spending. Pure and dependency-free so view.ts and everyday.ts can share it.
 *
 * Order of evidence in `categorize`: known merchant name → Nessie merchant category → description
 * keywords → Miscellaneous. Unknown purchases are never guessed into a specific category.
 */

export const SPENDING_CATEGORIES = [
  "automotive", "bills", "education", "entertainment", "fees", "food", "gas", "gifts",
  "groceries", "health", "home", "misc", "personal", "professional", "shopping", "travel",
] as const;

export type SpendingCategory = (typeof SPENDING_CATEGORIES)[number];
export type Category = "income" | "transfer" | SpendingCategory;

export const CATEGORY_LABEL: Record<Category, string> = {
  income: "Income",
  transfer: "Transfer",
  automotive: "Automotive",
  bills: "Bills & Utilities",
  education: "Education",
  entertainment: "Entertainment",
  fees: "Fees & Adjustments",
  food: "Food & Drink",
  gas: "Gas",
  gifts: "Gifts & Donations",
  groceries: "Groceries",
  health: "Health & Wellness",
  home: "Home",
  misc: "Miscellaneous",
  personal: "Personal",
  professional: "Professional Services",
  shopping: "Shopping",
  travel: "Travel",
};

const SPENDING_SET: ReadonlySet<string> = new Set(SPENDING_CATEGORIES);

export const isSpendingCategory = (v: unknown): v is SpendingCategory => typeof v === "string" && SPENDING_SET.has(v);
export const isCategory = (v: unknown): v is Category => v === "income" || v === "transfer" || isSpendingCategory(v);

/** Nessie merchant `category` values (lower-cased) → our categories. */
export const NESSIE_CATEGORY: Record<string, SpendingCategory> = {
  groceries: "groceries",
  fuel: "gas",
  gas: "gas",
  dining: "food",
  coffee: "food",
  pharmacy: "health",
  rideshare: "travel",
  retail: "shopping",
  entertainment: "entertainment",
  home: "home",
  misc: "misc",
  travel: "travel",
  electronics: "shopping",
  gambling: "entertainment",
};

/** Seeded merchant names (lower-cased) → categories. Amazon is seeded as Nessie "misc" but is shopping. */
const MERCHANT_CATEGORY: Record<string, SpendingCategory> = {
  "tom thumb": "groceries",
  quiktrip: "gas",
  "torchy's tacos": "food",
  starbucks: "food",
  "cvs pharmacy": "health",
  uber: "travel",
  target: "shopping",
  amazon: "shopping",
  "amc theatres": "entertainment",
  "home depot": "home",
};

/** Description keyword rules, first match wins. Kept narrow so a rule never mislabels a common word. */
const KEYWORD_RULES: [RegExp, SpendingCategory][] = [
  [/\b(fee|interest charge|adjustment|overdraft)\b/i, "fees"],
  [/\b(toyota|jiffy lube|oil change|car wash|auto ?parts|autozone|tire|dmv)\b/i, "automotive"],
  [/\b(t-mobile|verizon|at&t|comcast|xfinity|utility|utilities|electric|water|internet)\b/i, "bills"],
  [/\b(tuition|school|college|university|coursera|udemy|textbook)\b/i, "education"],
  [/\b(donation|charity|red cross|gofundme|gift)\b/i, "gifts"],
  [/\b(pharmacy|walgreens|doctor|dental|clinic|hospital|fitness|gym)\b/i, "health"],
  [/\b(haircut|salon|barber|great clips|spa|laundry|dry clean)/i, "personal"],
  [/\b(tax prep|h&r block|attorney|lawyer|accountant|consulting)\b/i, "professional"],
  [/\b(air ?lines?|airways|hotel|airbnb|lyft|amtrak|expedia)\b/i, "travel"],
  [/\b(netflix|spotify|hulu|theatres?|cinema|concert|casino|steam)\b/i, "entertainment"],
  [/\b(shell|exxon|chevron|valero|fuel)\b/i, "gas"],
  [/\b(kroger|h-e-b|heb|aldi|whole foods|trader joe|grocery|market)\b/i, "groceries"],
  [/\b(chipotle|mcdonald|restaurant|cafe|coffee|pizza|taco|grill|bar)\b/i, "food"],
  [/\b(walmart|best buy|costco|macy|nordstrom|ikea)\b/i, "shopping"],
];

/** Category for one bank transaction. `nessieCategory` is the merchant's category when known. */
export function categorize(kind: string, description = "", nessieCategory?: string | null): Category {
  if (kind === "deposit") return "income";
  if (kind === "transfer" || kind === "withdrawal") return "transfer";
  const d = description.trim().toLowerCase();
  const byMerchant = MERCHANT_CATEGORY[d];
  if (byMerchant) return byMerchant;
  const byNessie = nessieCategory ? NESSIE_CATEGORY[nessieCategory.trim().toLowerCase()] : undefined;
  if (byNessie) return byNessie;
  const rule = KEYWORD_RULES.find(([re]) => re.test(d));
  return rule ? rule[1] : "misc";
}
