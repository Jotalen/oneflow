import { describe, expect, test } from "vitest";
import { toContents, isRetryableGeminiError } from "@/lib/llm/gemini";

describe("gemini message mapping", () => {
  test("tool results go back as ONE user turn of functionResponse parts (Gemini 3.x rejects role 'function')", () => {
    const { contents } = toContents([
      { role: "system", content: "sys" },
      { role: "user", content: "hi" },
      { role: "assistant", content: "", toolCalls: [{ id: "1", name: "get_health", args: {} }, { id: "2", name: "simulate_move", args: { moveId: "x" } }] },
      { role: "tool", name: "get_health", toolCallId: "1", content: "{\"a\":1}" },
      { role: "tool", name: "simulate_move", toolCallId: "2", content: "{\"b\":2}" },
      { role: "user", content: "and?" },
    ]);
    expect(contents.some((c) => c.role === "function")).toBe(false);
    expect(contents.map((c) => c.role)).toEqual(["user", "model", "user", "user"]);
    expect(contents[2].parts).toHaveLength(2);
    expect(contents[2].parts.every((p) => "functionResponse" in p)).toBe(true);
  });
});

describe("model fallback", () => {
  test("overload, rate limit, retired model and unsupported role are retryable on the next model", () => {
    expect(isRetryableGeminiError(new Error("[503 ] This model is currently experiencing high demand"))).toBe(true);
    expect(isRetryableGeminiError(new Error("[429 ] quota"))).toBe(true);
    expect(isRetryableGeminiError(new Error("[404 ] models/x is no longer available"))).toBe(true);
    expect(isRetryableGeminiError(new Error("[400 ] API key not valid"))).toBe(false);
  });
});

describe("thought signatures", () => {
  test("a tool call's thought signature is echoed back on its functionCall part", () => {
    const { contents } = toContents([
      { role: "user", content: "hi" },
      { role: "assistant", content: "", toolCalls: [{ id: "1", name: "get_health", args: {}, signature: "SIG123" }] },
      { role: "tool", name: "get_health", toolCallId: "1", content: "{}" },
    ]);
    expect(contents[1].parts[0]).toMatchObject({ functionCall: { name: "get_health" }, thoughtSignature: "SIG123" });
  });
});
