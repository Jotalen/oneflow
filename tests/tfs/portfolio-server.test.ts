import { describe, expect, test } from "vitest";
import { analyze } from "@/lib/engine/analyze";
import { topTfsMove } from "@/lib/engine/moves/rank";
import { syntheticProfile } from "@/lib/server/analysis";
import { portfolioInputs, snapshotProfile, tfsPortfolio } from "@/lib/server/tfs-portfolio";
import { loadToyota } from "@/lib/toyota/load";

const toyota = loadToyota();

describe("snapshotProfile", () => {
  test("reads the bundled snapshot profile for a known customer", () => {
    const p = snapshotProfile("C001");
    expect(p?.personaId).toBe("C001");
    expect(p?.carOptions.length).toBeGreaterThan(0);
  });
  test("returns null for an unknown customer or unsafe id", () => {
    expect(snapshotProfile("C999")).toBeNull();
    expect(snapshotProfile("../package")).toBeNull();
  });
});

describe("portfolioInputs", () => {
  test("covers all 20 customers from snapshots, without live Nessie", () => {
    const inputs = portfolioInputs();
    expect(inputs.map((i) => i.profile.personaId)).toEqual(toyota.customers.map((c) => c.customer_id));
    expect(inputs.every((i) => i.source === "snapshot")).toBe(true);
  });

  test("each top move equals the engine on the synthetic bank (what the app shows offline)", () => {
    for (const i of portfolioInputs()) {
      const synth = topTfsMove(analyze(syntheticProfile(i.profile.personaId), toyota).ranked);
      const ours = topTfsMove(i.ranked);
      expect(ours?.tfs?.optionId, i.profile.personaId).toBe(synth?.tfs?.optionId);
      expect(ours?.goldenMatch, i.profile.personaId).toBe(synth?.goldenMatch);
    }
  });
});

describe("tfsPortfolio (data pack + engine, current release)", () => {
  const pf = tfsPortfolio();

  test("11 of 20 top moves match the TFS reference answer", () => {
    expect(pf.rows.filter((r) => r.goldenMatch).map((r) => r.customerId)).toEqual(
      ["C001", "C003", "C005", "C008", "C009", "C011", "C012", "C014", "C015", "C017", "C019"],
    );
    expect(pf.totals.goldenMatches).toBe(11);
  });

  test("next-step mix: 9 offers, 7 self-service, 4 human handoffs", () => {
    expect(pf.totals.nextStep).toEqual({ "Self-service": 7, "Follow-up": 0, Offer: 9, Human: 4 });
  });

  test("expected value captured on matched moves is $2,278.05 (pack values)", () => {
    expect(pf.totals.expectedValue.matched).toBe(227_805);
  });

  test("four vulnerable customers get a person; their sales offers are withheld", () => {
    expect(pf.totals.guardrails.humanHandoffs).toBe(4);
    expect(pf.rows.filter((r) => r.guardrail.humanHandoff).map((r) => r.customerId)).toEqual(["C002", "C011", "C014", "C016"]);
    expect(pf.totals.guardrails.withheldOffers).toBeGreaterThan(0);
  });
});
