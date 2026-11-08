import { describe, expect, test } from "vitest";
import {
  CATEGORY_LABEL, NESSIE_CATEGORY, SPENDING_CATEGORIES, categorize, isCategory, isSpendingCategory,
} from "@/lib/bank/categories";

const EXPECTED_LABELS = [
  "Automotive", "Bills & Utilities", "Education", "Entertainment", "Fees & Adjustments", "Food & Drink", "Gas",
  "Gifts & Donations", "Groceries", "Health & Wellness", "Home", "Miscellaneous", "Personal", "Professional Services",
  "Shopping", "Travel",
];

describe("spending categories", () => {
  test("are exactly the agreed set of 16, in alphabetical order", () => {
    expect(SPENDING_CATEGORIES.map((c) => CATEGORY_LABEL[c])).toEqual(EXPECTED_LABELS);
  });
  test("income and transfer are labelled but are not spending categories", () => {
    expect(CATEGORY_LABEL.income).toBe("Income");
    expect(CATEGORY_LABEL.transfer).toBe("Transfer");
    expect(isSpendingCategory("income")).toBe(false);
    expect(isSpendingCategory("transfer")).toBe(false);
    expect(isSpendingCategory("food")).toBe(true);
  });
  test("isCategory rejects old or unknown keys (e.g. a stale localStorage override)", () => {
    expect(isCategory("groceries")).toBe(true);
    expect(isCategory("dining")).toBe(false);
    expect(isCategory("fun")).toBe(false);
    expect(isCategory(42)).toBe(false);
  });
});

describe("Nessie merchant category mapping", () => {
  test.each([
    ["groceries", "groceries"], ["fuel", "gas"], ["gas", "gas"], ["dining", "food"], ["coffee", "food"],
    ["pharmacy", "health"], ["rideshare", "travel"], ["retail", "shopping"], ["entertainment", "entertainment"],
    ["home", "home"], ["misc", "misc"], ["travel", "travel"], ["electronics", "shopping"], ["gambling", "entertainment"],
  ])("%s → %s", (nessie, ours) => {
    expect(NESSIE_CATEGORY[nessie]).toBe(ours);
    expect(categorize("purchase", "Some Store", nessie)).toBe(ours);
  });
  test("every mapped value is one of the 16 spending categories", () => {
    for (const v of Object.values(NESSIE_CATEGORY)) expect(isSpendingCategory(v)).toBe(true);
  });
  test("Nessie category is case-insensitive", () => {
    expect(categorize("purchase", "", "Fuel")).toBe("gas");
  });
});

describe("categorize", () => {
  test("maps the seeded merchants by name", () => {
    expect(categorize("purchase", "Tom Thumb")).toBe("groceries");
    expect(categorize("purchase", "QuikTrip")).toBe("gas");
    expect(categorize("purchase", "Torchy's Tacos")).toBe("food");
    expect(categorize("purchase", "Starbucks")).toBe("food");
    expect(categorize("purchase", "CVS Pharmacy")).toBe("health");
    expect(categorize("purchase", "Uber")).toBe("travel");
    expect(categorize("purchase", "Target")).toBe("shopping");
    expect(categorize("purchase", "Amazon")).toBe("shopping");
    expect(categorize("purchase", "AMC Theatres")).toBe("entertainment");
    expect(categorize("purchase", "Home Depot")).toBe("home");
  });
  test("a known merchant name wins over a vaguer Nessie category (Amazon is seeded as misc)", () => {
    expect(categorize("purchase", "Amazon", "misc")).toBe("shopping");
  });
  test("deposits are income, transfers and withdrawals are transfers", () => {
    expect(categorize("deposit", "Paycheck (Nurse)")).toBe("income");
    expect(categorize("transfer", "Runway: automatic savings")).toBe("transfer");
    expect(categorize("withdrawal", "ATM")).toBe("transfer");
  });
  test.each([
    ["Late fee", "fees"], ["Interest charge", "fees"], ["Jiffy Lube oil change", "automotive"],
    ["Toyota service center", "automotive"], ["T-Mobile", "bills"], ["City water utility", "bills"],
    ["Coursera tuition", "education"], ["Red Cross donation", "gifts"], ["Planet Fitness", "health"],
    ["Great Clips haircut", "personal"], ["H&R Block tax prep", "professional"], ["Delta Air Lines", "travel"],
    ["Netflix", "entertainment"], ["Shell", "gas"], ["Kroger", "groceries"], ["Chipotle", "food"],
  ])("description keywords: %s → %s", (desc, cat) => {
    expect(categorize("purchase", desc)).toBe(cat);
  });
  test("unknown purchases fall back to Miscellaneous, not a guessed category", () => {
    expect(categorize("purchase", "Unknown Shop")).toBe("misc");
    expect(categorize("purchase", "")).toBe("misc");
  });
});
