import { GeminiProvider } from "./gemini";
import type { LlmProvider } from "./provider";
import { StubProvider } from "./stub";

/** Provider from env: LLM_PROVIDER=gemini needs GEMINI_API_KEY; anything else (or missing key) → stub. */
export function getProvider(): LlmProvider {
  const want = (process.env.LLM_PROVIDER ?? "stub").toLowerCase();
  const key = process.env.GEMINI_API_KEY;
  if (want === "gemini" && key) return new GeminiProvider(key);
  return new StubProvider();
}
