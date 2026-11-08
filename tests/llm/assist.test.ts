import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { Analysis } from "@/lib/engine/analyze";
import { buildBankView } from "@/lib/bank/view";
import { runway } from "@/lib/bank/wealth";
import type { LlmProvider } from "@/lib/llm/provider";
import {
  SAFETY_LEAD, CARD_LEAD, safetyFacts, offlineSafety, classifyPurchase, parseAmount, whichCardFacts, offlineWhichCard,
  onlyKnownNumbers, answerAssist,
} from "@/lib/llm/assist";

const snap = (id: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/snapshots", `${id}.json`), "utf8")) as Analysis;
const provider = (name: LlmProvider["name"], text: string | Error): LlmProvider => ({
  name, chat: async () => { if (text instanceof Error) throw text; return { text }; },
});

describe("safetyFacts", () => {
  test("runway, essentials and fixed/flexible split come from code", () => {
    // Arrange
    const a = snap("C001");
    const v = buildBankView(a);
    // Act
    const f = safetyFacts(a, {});
    // Assert
    expect(f.essentialsMonthly).toBe(v.safetyNet.essentials.reduce((s, e) => s + e.value, 0));
    expect(f.runway).toEqual(runway(v.cash, f.essentialsMonthly));
    expect(f.fixed.map((e) => e.label)).toEqual(expect.arrayContaining(["Car payment", "Other debt payments"]));
    expect(f.flexible.map((e) => e.label)).toContain("Groceries");
    expect(f.pausable.map((s) => s.name)).toEqual(["Netflix", "Spotify", "Planet Fitness"]);
    expect(f.pausableMonthly).toBe(1_599 + 1_199 + 3_999);
    expect(f.card).toMatchObject({ name: "Rewards Card", aprPct: 22.99, minimum: 5_721 });
  });
  test("the customer's own essentials change the runway", () => {
    const a = snap("C001");
    const base = safetyFacts(a, {});
    const lower = safetyFacts(a, { groceries: 0 });
    expect(lower.essentialsMonthly).toBeLessThan(base.essentialsMonthly);
    expect(lower.runway!.days).toBeGreaterThan(base.runway!.days);
  });
  test("fixed bills ignore overrides", () => {
    const a = snap("C001");
    expect(safetyFacts(a, { "car-payment": 0 }).essentialsMonthly).toBe(safetyFacts(a, {}).essentialsMonthly);
  });
  test("pausing subscriptions and trimming flexible spending lengthen the runway", () => {
    const f = safetyFacts(snap("C001"), {});
    expect(f.ifPaused!.days).toBeGreaterThan(f.runway!.days);
    expect(f.ifTrimmed!.days).toBeGreaterThan(f.runway!.days);
  });
  test("a CD shows up so the answer can warn about early withdrawal", () => {
    expect(safetyFacts(snap("C005"), {}).cdBalance).toBe(1_000_000);
    expect(safetyFacts(snap("C001"), {}).cdBalance).toBe(0);
  });
});

describe("offlineSafety", () => {
  test("starts with the lead and lists numbered steps built from the facts", () => {
    // Arrange
    const f = safetyFacts(snap("C001"), {});
    // Act
    const text = offlineSafety(f);
    // Assert
    const lines = text.split("\n");
    expect(lines[0]).toBe(SAFETY_LEAD);
    expect(lines[1]).toMatch(/^1\. /);
    expect(text).toContain("Netflix, Spotify and Planet Fitness");
    expect(text).toContain("22.99% APR");
    expect(text).toContain(`${f.runway!.days} days`);
  });
  test("is deterministic", () => {
    const f = safetyFacts(snap("C003"), {});
    expect(offlineSafety(f)).toBe(offlineSafety(f));
  });
  test("mentions the CD penalty only when there is a CD", () => {
    expect(offlineSafety(safetyFacts(snap("C005"), {}))).toMatch(/CD/);
    expect(offlineSafety(safetyFacts(snap("C001"), {}))).not.toMatch(/\bCD\b/);
  });
});

describe("classifyPurchase", () => {
  test.each([
    ["groceries", "groceries"], ["weekly grocery run at Tom Thumb", "groceries"], ["gas", "gas"], ["filling up the tank", "gas"],
    ["dinner with friends", "dining"], ["coffee", "dining"], ["flights to Denver", "travel"], ["hotel", "travel"],
    ["online shopping", "online"], ["something on Amazon", "online"], ["a big purchase", "big"], ["a new laptop for $1,200", "big"],
    ["socks", "other"],
  ])("%s → %s", (q, kind) => {
    expect(classifyPurchase(q)).toBe(kind);
  });
});

describe("parseAmount", () => {
  test("reads a dollar amount from the question", () => {
    expect(parseAmount("a new laptop for $1,200")).toBe(120_000);
    expect(parseAmount("tv 799.99")).toBe(79_999);
    expect(parseAmount("groceries")).toBeNull();
  });
});

describe("whichCardFacts / offlineWhichCard", () => {
  test("one card: answers honestly with its multiplier for the category", () => {
    // Arrange
    const f = whichCardFacts(snap("C001"), "dinner out");
    // Act
    const text = offlineWhichCard(f);
    // Assert
    expect(f.best).toMatchObject({ name: "Rewards Card", rate: 3, aprPct: 22.99 });
    expect(text.startsWith(`${CARD_LEAD} your Rewards Card, because it earns 3x points on dining`)).toBe(true);
    expect(text).toContain("about $3.00 back for every $100");
    expect(text).toContain("only card you have with us");
    expect(text).toContain("22.99% APR");
  });
  test("base-rate categories say 1x plainly", () => {
    const text = offlineWhichCard(whichCardFacts(snap("C001"), "travel"));
    expect(text).toContain("1x points on travel");
  });
  test("a big purchase over the available credit says so", () => {
    const a = snap("C014"); // $1,000 limit, $988.97 used
    const f = whichCardFacts(a, "a big purchase of $500");
    expect(f.fitsAvailable).toBe(false);
    expect(offlineWhichCard(f)).toMatch(/more than the .* you have available/);
  });
  test("a big purchase that fits reports the utilization after it", () => {
    const f = whichCardFacts(snap("C001"), "a big purchase of $200");
    expect(f.fitsAvailable).toBe(true);
    expect(f.utilAfterPct).toBe(Math.round(((286_050 + 20_000) / 500_000) * 100));
  });
  test("several cards: picks the higher multiplier and names the other", () => {
    const a = snap("C001");
    const second = { id: "k2", kind: "card" as const, nickname: "Travel Card", balance: 0, available: 300_000, creditLimit: 300_000 };
    const two = { ...a, profile: { ...a.profile, accounts: [...a.profile.accounts, second] } };
    const f = whichCardFacts(two, "dining", { "Travel Card": { dining: 1 } });
    expect(f.cards).toHaveLength(2);
    expect(f.best!.name).toBe("Rewards Card");
    expect(offlineWhichCard(f)).toContain("Travel Card");
  });
  test("no card: says to use checking", () => {
    const a = snap("C001");
    const none = { ...a, profile: { ...a.profile, accounts: a.profile.accounts.filter((x) => x.kind !== "card") } };
    expect(offlineWhichCard(whichCardFacts(none, "gas"))).toMatch(/don't have a OneFlow card/);
  });
});

describe("onlyKnownNumbers", () => {
  test("allows numbers that appear in the facts and small list numbers", () => {
    expect(onlyKnownNumbers("1. Pause Netflix to save $15.99 a month at 22.99%", "Netflix $15.99 22.99% APR")).toBe(true);
  });
  test("rejects a number the facts don't have", () => {
    expect(onlyKnownNumbers("You could save $400 a month", "Netflix $15.99")).toBe(false);
  });
});

describe("answerAssist", () => {
  const a = snap("C001");
  test("uses the first provider that answers with known numbers", async () => {
    const f = safetyFacts(a, {});
    const good = `${SAFETY_LEAD}\n1. Pause Netflix, Spotify and Planet Fitness to stretch your cash to ${f.ifPaused!.days} days.`;
    const r = await answerAssist({ analysis: a, topic: "safety_net" }, [provider("gemini", new Error("[503] busy")), provider("openrouter", good)]);
    expect(r).toEqual({ text: good, source: "openrouter" });
  });
  test("a model that invents a number falls through to the offline answer", async () => {
    const r = await answerAssist({ analysis: a, topic: "safety_net" }, [provider("gemini", `${SAFETY_LEAD}\n1. Save $12,345 a month.`)]);
    expect(r.source).toBe("offline");
    expect(r.text).toBe(offlineSafety(safetyFacts(a, {})));
  });
  test("adds the required lead when the model leaves it off", async () => {
    const r = await answerAssist({ analysis: a, topic: "which_card", question: "groceries" }, [provider("gemini", "your Rewards Card, because it earns 2x points on groceries.")]);
    expect(r.source).toBe("gemini");
    expect(r.text.startsWith(CARD_LEAD)).toBe(true);
  });
  test("never calls the coach stub; with no keys it answers offline", async () => {
    const stub: LlmProvider = { name: "stub", chat: async () => { throw new Error("should not be called"); } };
    const r = await answerAssist({ analysis: a, topic: "which_card", question: "gas" }, [stub]);
    expect(r.source).toBe("offline");
    expect(r.text).toBe(offlineWhichCard(whichCardFacts(a, "gas")));
  });
});
