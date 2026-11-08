import { describe, expect, it } from "vitest";
import { suggestPrompts, topicOf } from "@/lib/chat/suggestions";

const lease = { contract: { type: "lease" as const, monthsRemaining: 3 }, hasCardDebt: true, safetyNetMonths: 9, past: [] };

describe("suggestPrompts", () => {
  it("always returns exactly 3 different prompts", () => {
    // Act
    const p = suggestPrompts(lease);
    // Assert
    expect(p).toHaveLength(3);
    expect(new Set(p).size).toBe(3);
  });

  it("leads with the lease when it ends soon", () => {
    expect(suggestPrompts(lease)[0]).toMatch(/lease ends in 3 months/i);
  });

  it("puts a follow-up on the last chat topic first", () => {
    const p = suggestPrompts({ ...lease, past: ["Can I put 5% of my paycheck into Solana?"] });
    expect(topicOf(p[0])).toBe("solana");
    expect(p[0]).not.toBe("Can I put 5% of my paycheck into Solana?");
  });

  it("offers building the safety net when it's thin and there's no car contract", () => {
    const p = suggestPrompts({ contract: null, hasCardDebt: false, safetyNetMonths: 1.2, past: [] });
    expect(p.join(" ")).toMatch(/safety net/i);
  });
});

describe("topicOf", () => {
  it("classifies questions by topic", () => {
    expect(topicOf("Which Toyota could I afford?")).toBe("car");
    expect(topicOf("Plan my next two paychecks")).toBe("plan");
    expect(topicOf("buy SOL every payday")).toBe("solana");
    expect(topicOf("hello")).toBe("other");
  });
});
