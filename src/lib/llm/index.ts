import { GeminiProvider } from "./gemini";
import { OpenRouterProvider } from "./openrouter";
import type { LlmProvider } from "./provider";
import { StubProvider } from "./stub";

/**
 * Providers to try in order. LLM_PROVIDER=gemini (with GEMINI_API_KEY) puts Gemini first, OpenRouter
 * (OPENROUTER_API_KEY) is next, and the deterministic stub always ends the chain so the coach never errors.
 */
export function providerChain(): LlmProvider[] {
  const want = (process.env.LLM_PROVIDER ?? "stub").toLowerCase();
  const chain: LlmProvider[] = [];
  if (want !== "stub" && process.env.GEMINI_API_KEY && want !== "openrouter") chain.push(new GeminiProvider(process.env.GEMINI_API_KEY));
  if (want !== "stub" && process.env.OPENROUTER_API_KEY) chain.push(new OpenRouterProvider(process.env.OPENROUTER_API_KEY));
  chain.push(new StubProvider());
  return chain;
}

/** First provider of the chain (kept for callers that want a single provider). */
export const getProvider = (): LlmProvider => providerChain()[0];
