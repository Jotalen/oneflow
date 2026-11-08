import { describe, expect, test } from "vitest";
import { analyze } from "@/lib/engine/analyze";
import { topTfsMove } from "@/lib/engine/moves/rank";
import type { Profile } from "@/lib/engine/types";
import { buildPortfolio, effortBucket, nextStepBucket, type PortfolioInput } from "@/lib/tfs/portfolio";
import { profileFor, toyota } from "../fixtures/profiles";

const input = (p: Profile): PortfolioInput => ({ profile: p, ranked: analyze(p, toyota).ranked, source: "snapshot" });
const allInputs = () => toyota.customers.map((c) => input(profileFor(c.customer_id)));
const golden = (id: string) => toyota.golden.find((g) => g.customer_id === id)!;

describe("nextStepBucket", () => {
  test("the human handoff is its own bucket, not a generic follow-up", () => {
    expect(nextStepBucket("human", "Follow-up")).toBe("Human");
  });
  test("normalizes catalog wording such as 'Follow-up (specialist)'", () => {
    expect(nextStepBucket("car", "Follow-up (specialist)")).toBe("Follow-up");
    expect(nextStepBucket("car", "Self-service")).toBe("Self-service");
    expect(nextStepBucket("bank", "Self-service")).toBe("Self-service");
    expect(nextStepBucket("car", "Offer")).toBe("Offer");
  });
  test("unknown wording returns null instead of guessing", () => {
    expect(nextStepBucket("car", "Something else")).toBeNull();
  });
});

describe("effortBucket", () => {
  test("reads the leading level of offers_catalog service_effort", () => {
    expect(effortBucket("Low (digital)")).toBe("Low");
    expect(effortBucket("Very low")).toBe("Very low");
    expect(effortBucket("Medium (human review)")).toBe("Medium");
    expect(effortBucket("High")).toBe("High");
    expect(effortBucket(undefined)).toBeNull();
    expect(effortBucket("n/a")).toBeNull();
  });
});

describe("buildPortfolio rows", () => {
  test("one row per customer, with name, contract type and vehicle", () => {
    const pf = buildPortfolio(allInputs(), toyota);
    expect(pf.rows).toHaveLength(20);
    const c003 = pf.rows.find((r) => r.customerId === "C003")!;
    expect(c003.name).toBe("Priya");
    expect(c003.contractType).toBe("lease");
    expect(c003.vehicle).toMatch(/\d{4} /);
  });

  test("top move and golden badge come from rankMoves, never re-derived", () => {
    const inputs = allInputs();
    const pf = buildPortfolio(inputs, toyota);
    for (const [i, row] of pf.rows.entries()) {
      const top = topTfsMove(inputs[i].ranked);
      expect(row.topMove?.optionId).toBe(top?.tfs?.optionId);
      expect(row.goldenMatch).toBe(top?.goldenMatch ?? false);
    }
  });

  test("a golden match is reported only when the engine set the badge", () => {
    const p = profileFor("C003");
    const ranked = analyze(p, toyota).ranked.map((m) => ({ ...m, goldenMatch: false }));
    const pf = buildPortfolio([{ profile: p, ranked, source: "snapshot" }], toyota);
    expect(pf.rows[0].goldenMatch).toBe(false);
    expect(pf.totals.goldenMatches).toBe(0);
  });

  test("expected value is the pack's golden expected_value_usd, in cents", () => {
    const pf = buildPortfolio(allInputs(), toyota);
    const c001 = pf.rows.find((r) => r.customerId === "C001")!;
    expect(c001.expectedValue).toBe(golden("C001").expected_value_usd);
    expect(c001.expectedValue).toBe(12_600);
    expect(c001.takeRate).toBe(0.3);
  });

  test("vulnerable customer: human next step, every eligible option withheld", () => {
    const pf = buildPortfolio([input(profileFor("C014"))], toyota);
    const row = pf.rows[0];
    expect(row.nextStep).toBe("Human");
    expect(row.guardrail.humanHandoff).toBe(true);
    const eligibleIds = profileFor("C014").carOptions.filter((o) => o.option_id !== "KEEP" && /^(Y|Review)/i.test(o.eligibility)).map((o) => o.option_id);
    expect(row.withheldOptionIds.sort()).toEqual(eligibleIds.sort());
  });

  test("no marketing consent withholds new-vehicle offers only", () => {
    const base = profileFor("C004");
    const p: Profile = { ...base, flags: { ...base.flags, marketingConsent: false } };
    const row = buildPortfolio([input(p)], toyota).rows[0];
    expect(row.guardrail.noNewVehicleOffers).toBe(true);
    expect(row.guardrail.humanHandoff).toBe(false);
    expect(row.withheldOptionIds).toEqual(["TRADE"]);
    expect(row.withheldOfferIds).toEqual(["TRADE"]);
  });

  test("no guardrail: nothing withheld", () => {
    const row = buildPortfolio([input(profileFor("C001"))], toyota).rows[0];
    expect(row.withheldOptionIds).toEqual([]);
  });

  test("a customer without a Toyota contract has no top move and nothing withheld", () => {
    const base = profileFor("C001");
    const p: Profile = { ...base, contract: undefined, car: undefined };
    const row = buildPortfolio([input(p)], toyota).rows[0];
    expect(row.contractType).toBeNull();
    expect(row.withheldOptionIds).toEqual([]);
  });

  test("service effort is the offers_catalog label of the top move's offer", () => {
    const pf = buildPortfolio(allInputs(), toyota);
    const c014 = pf.rows.find((r) => r.customerId === "C014")!;
    expect(c014.effort).toBe("High");
    const c001 = pf.rows.find((r) => r.customerId === "C001")!;
    expect(c001.effort).toBe("Low");
    expect(c001.referenceEffort).toBe("Low");
  });
});

describe("buildPortfolio totals", () => {
  test("next-step counts add up to the customer count", () => {
    const { totals } = buildPortfolio(allInputs(), toyota);
    const sum = Object.values(totals.nextStep).reduce((s, n) => s + n, 0);
    expect(sum).toBe(totals.customers);
    expect(totals.customers).toBe(20);
  });

  test("matched expected value sums only the rows with a golden match", () => {
    const pf = buildPortfolio(allInputs(), toyota);
    const matched = pf.rows.filter((r) => r.goldenMatch).reduce((s, r) => s + (r.expectedValue ?? 0), 0);
    const reference = toyota.golden.reduce((s, g) => s + (g.expected_value_usd ?? 0), 0);
    expect(pf.totals.expectedValue.matched).toBe(matched);
    expect(pf.totals.expectedValue.reference).toBe(reference);
    expect(pf.totals.expectedValue.matchedCustomers).toBe(pf.totals.goldenMatches);
    expect(Number.isInteger(pf.totals.expectedValue.matched)).toBe(true);
  });

  test("guardrail totals count protected customers and withheld offers", () => {
    const pf = buildPortfolio(allInputs(), toyota);
    const protectedRows = pf.rows.filter((r) => r.guardrail.humanHandoff || r.guardrail.noNewVehicleOffers);
    expect(pf.totals.guardrails.customersProtected).toBe(protectedRows.length);
    expect(pf.totals.guardrails.withheldOffers).toBe(pf.rows.reduce((s, r) => s + r.withheldOfferIds.length, 0));
    expect(pf.totals.guardrails.humanHandoffs).toBe(pf.rows.filter((r) => r.guardrail.humanHandoff).length);
  });

  test("effort mixes count one move per customer for ours and for the reference", () => {
    const { totals } = buildPortfolio(allInputs(), toyota);
    const sum = (r: Record<string, number>) => Object.values(r).reduce((s, n) => s + n, 0);
    expect(sum(totals.effort)).toBe(20);
    expect(sum(totals.referenceEffort)).toBe(20);
  });

  test("states its assumptions", () => {
    const pf = buildPortfolio(allInputs(), toyota);
    expect(pf.assumptions.length).toBeGreaterThan(0);
    expect(pf.assumptions.join(" ")).toMatch(/take rate/i);
  });
});
