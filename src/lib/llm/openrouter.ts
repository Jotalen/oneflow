import type { LlmProvider, LlmTurn, Msg, ToolDef } from "./provider";

/** OpenAI-compatible fallback via OpenRouter (used when Gemini's free tier is busy or rate limited). */
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "deepseek/deepseek-v4.1-flash";
const MAX_TOKENS = 1_500;
const TIMEOUT_MS = 25_000;

type OaMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[] }
  | { role: "tool"; tool_call_id: string; content: string };

export function toOpenAiMessages(messages: Msg[]): OaMessage[] {
  return messages.map((m): OaMessage => {
    if (m.role === "tool") return { role: "tool", tool_call_id: m.toolCallId ?? m.name ?? "tool", content: m.content };
    if (m.role === "assistant") {
      return m.toolCalls?.length
        ? { role: "assistant", content: m.content, tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.args) } })) }
        : { role: "assistant", content: m.content };
    }
    return { role: m.role, content: m.content };
  });
}

interface OaChoice { message: { content?: string | null; tool_calls?: { id: string; type?: string; function: { name: string; arguments?: string } }[] } }

export function fromOpenAiChoice(choice: OaChoice): LlmTurn {
  const calls = choice.message.tool_calls ?? [];
  if (calls.length) {
    return {
      toolCalls: calls.map((c) => {
        let args: Record<string, unknown> = {};
        try { args = c.function.arguments ? (JSON.parse(c.function.arguments) as Record<string, unknown>) : {}; } catch { args = {}; }
        return { id: c.id, name: c.function.name, args };
      }),
    };
  }
  return { text: choice.message.content ?? "" };
}

export class OpenRouterProvider implements LlmProvider {
  readonly name = "openrouter" as const;
  constructor(private readonly apiKey: string, private readonly model = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL) {}

  async chat(messages: Msg[], tools: ToolDef[]): Promise<LlmTurn> {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json", "x-title": "OneFlow NextMove" },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.3,
        max_tokens: MAX_TOKENS,
        messages: toOpenAiMessages(messages),
        ...(tools.length ? { tools: tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })) } : {}),
      }),
    });
    if (!res.ok) throw new Error(`[${res.status} ] OpenRouter: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { choices?: OaChoice[] };
    if (!json.choices?.[0]) throw new Error("OpenRouter: empty response");
    return fromOpenAiChoice(json.choices[0]);
  }
}
