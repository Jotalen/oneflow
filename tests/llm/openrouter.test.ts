import { describe, expect, test } from "vitest";
import { toOpenAiMessages, fromOpenAiChoice } from "@/lib/llm/openrouter";

describe("openrouter mapping", () => {
  test("maps our messages to OpenAI chat format with tool calls and tool results", () => {
    const out = toOpenAiMessages([
      { role: "system", content: "sys" },
      { role: "user", content: "hi" },
      { role: "assistant", content: "", toolCalls: [{ id: "c1", name: "get_health", args: { a: 1 } }] },
      { role: "tool", name: "get_health", toolCallId: "c1", content: "{\"ok\":true}" },
    ]);
    expect(out).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "hi" },
      { role: "assistant", content: "", tool_calls: [{ id: "c1", type: "function", function: { name: "get_health", arguments: "{\"a\":1}" } }] },
      { role: "tool", tool_call_id: "c1", content: "{\"ok\":true}" },
    ]);
  });
  test("reads tool calls (JSON-string args) or text from a choice", () => {
    expect(fromOpenAiChoice({ message: { content: null, tool_calls: [{ id: "x", type: "function", function: { name: "get_health", arguments: "{\"m\":2}" } }] } }))
      .toEqual({ toolCalls: [{ id: "x", name: "get_health", args: { m: 2 } }] });
    expect(fromOpenAiChoice({ message: { content: "hello" } })).toEqual({ text: "hello" });
  });
});
