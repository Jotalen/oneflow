import { describe, expect, test, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

const snap = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/snapshots/C003.json"), "utf8"));
const busy = (name: string) => ({ name, chat: async () => { throw new Error("[503] This model is currently experiencing high demand"); } });
let chain: () => unknown[] = () => [];
vi.mock("@/lib/server/analysis", () => ({
  invalidateAnalysis: () => {}, knownPersona: () => true, getAnalysis: async () => ({ analysis: snap, live: false }) }));
vi.mock("@/lib/llm", () => ({ providerChain: () => chain() }));

const ask = async () => {
  const { POST } = await import("@/app/api/coach/route");
  return POST(new Request("http://x/api/coach", { method: "POST", body: JSON.stringify({ persona: "C003", mode: "chat", message: "What should I do about my car?" }) }));
};

describe("POST /api/coach provider chain", () => {
  test("Gemini busy → OpenRouter answers", async () => {
    chain = () => [busy("gemini"), { name: "openrouter", chat: async () => ({ text: "Buy the car." }) }];
    const json = await (await ask()).json();
    expect(json.provider).toBe("openrouter");
    expect(json.text).toBe("Buy the car.");
    expect(json.notice).toMatch(/gemini/i);
  });
  test("every LLM busy → built-in narrator, never a 502", async () => {
    const { StubProvider } = await import("@/lib/llm/stub");
    chain = () => [busy("gemini"), busy("openrouter"), new StubProvider()];
    const res = await ask();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.provider).toBe("stub");
    expect(json.text.length).toBeGreaterThan(0);
    expect(json.notice).toMatch(/busy/i);
  });
});
