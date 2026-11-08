import { describe, expect, test, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

const snap = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/snapshots/C001.json"), "utf8"));
let chain: () => unknown[] = () => [];
vi.mock("@/lib/server/analysis", () => ({
  invalidateAnalysis: () => {}, knownPersona: (p: string) => p === "C001", getAnalysis: async () => ({ analysis: snap, live: false }) }));
vi.mock("@/lib/llm", () => ({ providerChain: () => chain() }));

const post = async (body: unknown) => {
  const { POST } = await import("@/app/api/assist/route");
  return POST(new Request("http://x/api/assist", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
};

describe("POST /api/assist", () => {
  test("safety_net with no keys answers offline with the lead", async () => {
    // Arrange
    chain = () => [];
    // Act
    const res = await post({ persona: "C001", topic: "safety_net" });
    // Assert
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.source).toBe("offline");
    expect(json.text).toMatch(/^To make your money last longer in case of emergencies, follow these steps:/);
  });
  test("which_card answers from the question", async () => {
    chain = () => [];
    const json = await (await post({ persona: "C001", topic: "which_card", question: "groceries" })).json();
    expect(json.text).toMatch(/^Based on the type of purchase you should use your Rewards Card, because it earns 2x points on groceries/);
  });
  test("a model answer is passed through with its source", async () => {
    chain = () => [{ name: "gemini", chat: async () => ({ text: "Based on the type of purchase you should use your Rewards Card, because it earns 2x points on groceries." }) }];
    const json = await (await post({ persona: "C001", topic: "which_card", question: "groceries" })).json();
    expect(json).toEqual({ ok: true, source: "gemini", text: "Based on the type of purchase you should use your Rewards Card, because it earns 2x points on groceries." });
  });
  test("essentials overrides change the safety answer", async () => {
    chain = () => [];
    const base = (await (await post({ persona: "C001", topic: "safety_net" })).json()).text as string;
    const lower = (await (await post({ persona: "C001", topic: "safety_net", essentialsOverrides: { groceries: 0 } })).json()).text as string;
    expect(lower).not.toBe(base);
  });
  test.each([
    ["unknown persona", { persona: "C999", topic: "safety_net" }],
    ["bad topic", { persona: "C001", topic: "stocks" }],
    ["which_card without a question", { persona: "C001", topic: "which_card" }],
    ["question too long", { persona: "C001", topic: "which_card", question: "x".repeat(301) }],
    ["negative override", { persona: "C001", topic: "safety_net", essentialsOverrides: { groceries: -1 } }],
    ["not json", "{nope"],
  ])("400 for %s", async (_name, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(typeof json.error).toBe("string");
  });
});
