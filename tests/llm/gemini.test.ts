import { describe, expect, test } from "vitest";
import { toContents } from "@/lib/llm/gemini";

describe("gemini message mapping", () => {
  test("consecutive tool results merge into one function turn with one part per call", () => {
    const { contents } = toContents([
      { role: "system", content: "sys" },
      { role: "user", content: "hi" },
      { role: "assistant", content: "", toolCalls: [{ id: "1", name: "get_health", args: {} }, { id: "2", name: "simulate_move", args: { moveId: "x" } }] },
      { role: "tool", name: "get_health", toolCallId: "1", content: "{\"a\":1}" },
      { role: "tool", name: "simulate_move", toolCallId: "2", content: "{\"b\":2}" },
      { role: "user", content: "and?" },
    ]);
    const fn = contents.filter((c) => c.role === "function");
    expect(fn).toHaveLength(1);
    expect(fn[0].parts).toHaveLength(2);
    expect(contents.map((c) => c.role)).toEqual(["user", "model", "function", "user"]);
  });
});
