import { describe, expect, test, vi } from "vitest";
import { analyze } from "@/lib/engine/analyze";
import { runCoach } from "@/lib/llm/coach";
import type { LlmProvider } from "@/lib/llm/provider";
import { runTool, TOOL_DEFS } from "@/lib/llm/tools";
import { profileFor, toyota } from "../fixtures/profiles";
import { fmtUSD } from "@/lib/money";

describe("coach tools", () => {
  test("exposes exactly the six approved tools", () => {
    expect(TOOL_DEFS.map((t) => t.name).sort()).toEqual(["execute_move", "get_car_options", "get_health", "get_profile", "run_projection", "simulate_move"]);
  });

  test("get_health returns engine health unchanged", async () => {
    const a = analyze(profileFor("C003"), toyota);
    expect(await runTool("get_health", {}, { analysis: a })).toEqual(a.health);
  });

  test("simulate_move returns impact for a known move and an error for an unknown one", async () => {
    const a = analyze(profileFor("C003"), toyota);
    const ok = (await runTool("simulate_move", { moveId: a.ranked[0].id }, { analysis: a })) as { impactFmt: string };
    expect(ok.impactFmt).toBe(fmtUSD(a.ranked[0].impact24));
    expect(await runTool("simulate_move", { moveId: "nope" }, { analysis: a })).toMatchObject({ error: expect.stringContaining("nope") });
  });

  test("execute_move is refused under human handoff and never calls the executor", async () => {
    const a = analyze(profileFor("C014"), toyota);
    const execute = vi.fn();
    const r = await runTool("execute_move", { moveId: "pay_highest_apr" }, { analysis: a, execute });
    expect(r).toMatchObject({ refused: true });
    expect(execute).not.toHaveBeenCalled();
  });

  test("tool loop stops after 4 rounds and still returns text", async () => {
    const a = analyze(profileFor("C003"), toyota);
    let calls = 0;
    const greedy: LlmProvider = {
      name: "stub",
      async chat() {
        calls++;
        return { toolCalls: [{ id: `c${calls}`, name: "get_health", args: {} }] };
      },
    };
    const { text, toolTrace } = await runCoach(a, "hi", greedy);
    expect(toolTrace).toHaveLength(4);
    expect(text.length).toBeGreaterThan(0);
  });
});

describe("review fixes — tools", () => {
  test("execute_move never executes from the model: returns confirmRequired and does not call the executor", async () => {
    const a = analyze(profileFor("C003"), toyota);
    const execute = vi.fn();
    const r = await runTool("execute_move", { moveId: "cancel_recurring" }, { analysis: a, execute });
    expect(r).toMatchObject({ confirmRequired: true, moveId: "cancel_recurring" });
    expect(execute).not.toHaveBeenCalled();
  });
  test("get_profile money fields are formatted strings, never raw cents", async () => {
    const a = analyze(profileFor("C003"), toyota);
    const r = (await runTool("get_profile", {}, { analysis: a })) as { accounts: { balance: string }[]; incomeMonthly: string; contract: { payment: string } | null };
    expect(r.accounts[0].balance).toMatch(/^\$/);
    expect(r.incomeMonthly).toMatch(/^\$/);
    expect(r.contract?.payment).toMatch(/^\$/);
    expect(JSON.stringify(r)).not.toMatch(/"(balance|available|creditLimit|monthlyPayment|payoffQuote|marketValue|incomeMonthly)":\d/);
  });
  test("simulate_move exposes impactFmt and no raw impact24", async () => {
    const a = analyze(profileFor("C003"), toyota);
    const r = (await runTool("simulate_move", { moveId: a.ranked[0].id }, { analysis: a })) as Record<string, unknown>;
    expect(r.impactFmt).toBe(fmtUSD(a.ranked[0].impact24));
    expect("impact24" in r).toBe(false);
  });
  test("tool loop caps total tool calls at 4 even when a turn returns two calls", async () => {
    const a = analyze(profileFor("C003"), toyota);
    const twoPerTurn: LlmProvider = { name: "stub", async chat() { return { toolCalls: [{ id: "a", name: "get_health", args: {} }, { id: "b", name: "get_health", args: {} }] }; } };
    const { toolTrace } = await runCoach(a, "hi", twoPerTurn);
    expect(toolTrace.length).toBeLessThanOrEqual(4);
  });
});
