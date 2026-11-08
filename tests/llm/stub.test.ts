import { describe, expect, test } from "vitest";
import { analyze } from "@/lib/engine/analyze";
import { fmtUSD } from "@/lib/money";
import { StubProvider } from "@/lib/llm/stub";
import { coachAnalyze, runCoach } from "@/lib/llm/coach";
import { profileFor, toyota } from "../fixtures/profiles";

const MONEY = /\$[\d,]+\.\d{2}/g;

describe("stub narrator", () => {
  test("brief for C003 names the top move and quotes its impact verbatim", async () => {
    const a = analyze(profileFor("C003"), toyota);
    const { brief, rankedIds } = await coachAnalyze(a, new StubProvider());
    expect(brief).toContain(a.ranked[0].title);
    expect(brief).toContain(fmtUSD(a.ranked[0].impact24));
    expect(rankedIds).toEqual(a.ranked.map((m) => m.id));
  });

  test("brief for C014 routes to a specialist and contains no dollar upsell", async () => {
    const a = analyze(profileFor("C014"), toyota);
    const { brief } = await coachAnalyze(a, new StubProvider());
    expect(brief.toLowerCase()).toContain("specialist");
    expect(brief).not.toMatch(/offer|refinance|trade/i);
  });

  test("brief never emits a dollar figure absent from engine output", async () => {
    const a = analyze(profileFor("C001"), toyota);
    const { brief } = await coachAnalyze(a, new StubProvider());
    const engineText = a.ranked.flatMap((m) => [m.title, m.why, m.tfs?.assumption ?? "", m.tfs?.tradeoff ?? ""]).join(" ");
    const allowed = new Set<string>([
      ...(engineText.match(MONEY) ?? []),
      ...a.ranked.map((m) => fmtUSD(m.impact24)),
      ...a.ranked.map((m) => fmtUSD(Math.abs(m.impact24))),
      ...a.profile.accounts.map((x) => fmtUSD(x.balance)),
      ...a.profile.debts.map((d) => fmtUSD(d.monthlyPayment)),
      fmtUSD(a.profile.incomeMonthly),
    ]);
    for (const tok of brief.match(MONEY) ?? []) expect(allowed.has(tok), `${tok} not from engine`).toBe(true);
  });

  test("chat answer ends with exactly one labeled next step", async () => {
    const a = analyze(profileFor("C003"), toyota);
    const { text } = await runCoach(a, "What should I do about my lease?", new StubProvider());
    expect(text.match(/Next step: (Self-service|Follow-up|Eligible offer)/g)).toHaveLength(1);
  });
});
