import { GoogleGenerativeAI, SchemaType, type Content, type FunctionDeclaration, type Part } from "@google/generative-ai";
import type { LlmProvider, LlmTurn, Msg, ToolDef } from "./provider";

const DEFAULT_MODEL = "gemini-2.5-flash";

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
      for (const c of m.toolCalls ?? []) parts.push({ functionCall: { name: c.name, args: c.args } });
      if (parts.length) contents.push({ role: "model", parts });
    } else if (m.role === "tool") {
      let response: object;
      try { response = { result: JSON.parse(m.content) }; } catch { response = { result: m.content }; }
      const part: Part = { functionResponse: { name: m.name ?? "tool", response } };
      const last = contents[contents.length - 1];
      if (last && last.role === "function") last.parts.push(part); // one function turn per batch of calls
      else contents.push({ role: "function", parts: [part] });
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
    const { system, contents } = toContents(messages);
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      systemInstruction: system,
      ...(tools.length ? { tools: [{ functionDeclarations: toDeclarations(tools) }] } : {}),
    });
    const res = await model.generateContent({ contents, generationConfig: { temperature: 0.3, maxOutputTokens: 600 } });
    const calls = res.response.functionCalls() ?? [];
    if (calls.length) return { toolCalls: calls.map((c, i) => ({ id: `g${Date.now()}_${i}`, name: c.name, args: (c.args ?? {}) as Record<string, unknown> })) };
    return { text: res.response.text() };
  }
}
