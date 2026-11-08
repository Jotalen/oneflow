import { GoogleGenerativeAI, SchemaType, type Content, type FunctionDeclaration, type Part } from "@google/generative-ai";
import type { LlmProvider, LlmTurn, Msg, ToolDef } from "./provider";

/** Narration only (the engine does the math), so the fastest model wins: ~0.7 s vs ~6 s for 3.5-flash on our prompts. */
const DEFAULT_MODEL = "gemini-3.1-flash-lite";
/** Tried in order after the configured model when it is overloaded, rate limited or retired. */
const FALLBACK_MODELS = ["gemini-3.5-flash"];
const RETRYABLE = /\[(503|429|404)\s*\]|high demand|overloaded|no longer available|Role 'function' is not supported/i;

export const isRetryableGeminiError = (e: unknown): boolean => RETRYABLE.test(e instanceof Error ? e.message : String(e));
/** Gemini 3.x thinking tokens count against this budget; 600 truncated answers mid-sentence. */
const MAX_OUTPUT_TOKENS = 4_096;

function toDeclarations(tools: ToolDef[]): FunctionDeclaration[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: {
      type: SchemaType.OBJECT,
      properties: Object.fromEntries(Object.entries(t.parameters.properties).map(([k, v]) => [k, { type: SchemaType.STRING, description: v.description }])),
      required: t.parameters.required ?? [],
    },
  }));
}

export function toContents(messages: Msg[]): { system: string; contents: Content[] } {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents: Content[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "user") contents.push({ role: "user", parts: [{ text: m.content }] });
    else if (m.role === "assistant") {
      const parts: Part[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const c of m.toolCalls ?? []) parts.push({ functionCall: { name: c.name, args: c.args }, ...(c.signature ? { thoughtSignature: c.signature } : {}) } as Part);
      if (parts.length) contents.push({ role: "model", parts });
    } else if (m.role === "tool") {
      let response: object;
      try { response = { result: JSON.parse(m.content) }; } catch { response = { result: m.content }; }
      const part: Part = { functionResponse: { name: m.name ?? "tool", response } };
      // One user turn per batch of calls; Gemini 3.x rejects the legacy "function" role.
      const last = contents[contents.length - 1];
      if (last && last.role === "user" && last.parts.every((p) => "functionResponse" in p)) last.parts.push(part);
      else contents.push({ role: "user", parts: [part] });
    }
  }
  return { system, contents };
}

export class GeminiProvider implements LlmProvider {
  readonly name = "gemini" as const;
  private readonly client: GoogleGenerativeAI;
  constructor(apiKey: string, private readonly modelName = process.env.GEMINI_MODEL ?? DEFAULT_MODEL) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async chat(messages: Msg[], tools: ToolDef[]): Promise<LlmTurn> {
    const models = [this.modelName, ...FALLBACK_MODELS.filter((m) => m !== this.modelName)];
    let lastErr: unknown;
    for (const name of models) {
      try {
        return await this.chatWith(name, messages, tools);
      } catch (e) {
        lastErr = e;
        if (!isRetryableGeminiError(e)) throw e;
      }
    }
    throw lastErr;
  }

  private async chatWith(modelName: string, messages: Msg[], tools: ToolDef[]): Promise<LlmTurn> {
    const { system, contents } = toContents(messages);
    const model = this.client.getGenerativeModel({
      model: modelName,
      systemInstruction: system,
      ...(tools.length ? { tools: [{ functionDeclarations: toDeclarations(tools) }] } : {}),
    });
    const res = await model.generateContent({ contents, generationConfig: { temperature: 0.3, maxOutputTokens: MAX_OUTPUT_TOKENS } });
    const parts = (res.response.candidates?.[0]?.content?.parts ?? []) as (Part & { thoughtSignature?: string })[];
    const callParts = parts.filter((p) => p.functionCall);
    if (callParts.length) {
      return { toolCalls: callParts.map((p, i) => ({ id: `g${Date.now()}_${i}`, name: p.functionCall!.name, args: (p.functionCall!.args ?? {}) as Record<string, unknown>, signature: p.thoughtSignature })) };
    }
    return { text: res.response.text() };
  }
}
