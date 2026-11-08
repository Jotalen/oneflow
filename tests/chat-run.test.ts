import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/engine/analyze";
import { buildBankView } from "@/lib/bank/view";
import { AS_OF } from "@/lib/engine/types";
import { loadToyota } from "@/lib/toyota/load";
import { syntheticProfile } from "@/lib/server/analysis";
import { ChatStub, runChat } from "@/lib/chat/run";
import type { ChatCtx } from "@/lib/chat/facts";
import { factsFor } from "@/lib/chat/facts";

function ctxFor(persona: string): ChatCtx {
  const t = loadToyota();
  const analysis = analyze(syntheticProfile(persona), t);
  return { analysis, view: buildBankView(analysis), rates: t.rates, today: AS_OF };
}

describe("runChat with the offline narrator", () => {
  it("checks a 5% Solana auto-buy and returns a plan to confirm when it fits", async () => {
    // Act
    const r = await runChat(ctxFor("C018"), "Can I put 5% of my paycheck into Solana?", new ChatStub());
    // Assert
    expect(r.topics).toContain("solana");
    expect(r.text).toMatch(/each payday/);
    if (!/Not right now/.test(r.text)) expect(r.proposal?.percent).toBe(5);
  });

  it("prices real Toyota models and never calls them samples", async () => {
    const r = await runChat(ctxFor("C003"), "Which Toyota could I afford?", new ChatStub());
    expect(r.topics).toContain("car");
    expect(r.text).toMatch(/\/mo/);
    expect(r.text).not.toMatch(/sample|demo/i);
  });

  it("leads with the model the customer asked about", () => {
    const f = factsFor(ctxFor("C018"), "I want to buy a new GR86");
    const toyota = f.extra.toyota as { askedAbout: { model: string; rate: string }[] };
    expect(toyota.askedAbout[0].model).toBe("2027 GR86");
    expect(toyota.askedAbout[0].rate).toMatch(/standard TFS rate/);
  });

  it("gives the model the whole account: rewards, credit, car and transactions", () => {
    const a = factsFor(ctxFor("C018"), "hi").account as Record<string, unknown>;
    expect(Object.keys(a)).toEqual(expect.arrayContaining(["rewards", "credit", "car", "carFinancing", "recentTransactions", "accounts", "budgetThisMonth"]));
  });

  it("plans the next month of paychecks and bills", async () => {
    const r = await runChat(ctxFor("C018"), "Plan my next two paychecks around my bills", new ChatStub());
    expect(r.text).toMatch(/Paycheck/);
  });

  it("sends a vulnerable customer to a specialist instead of offers", async () => {
    const r = await runChat(ctxFor("C014"), "Which Toyota specials can I afford?", new ChatStub());
    expect(r.text).toMatch(/specialist/i);
    expect(r.proposal).toBeUndefined();
  });
});
