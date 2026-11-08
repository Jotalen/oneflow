export type Role = "system" | "user" | "assistant" | "tool";
export interface ToolCall { id: string; name: string; args: Record<string, unknown> }
export interface Msg { role: Role; content: string; toolCalls?: ToolCall[]; toolCallId?: string; name?: string }
export interface ToolDef { name: string; description: string; parameters: { type: "object"; properties: Record<string, { type: string; description?: string }>; required?: string[] } }
export interface LlmTurn { text?: string; toolCalls?: ToolCall[] }

export interface LlmProvider {
  readonly name: "stub" | "gemini";
  chat(messages: Msg[], tools: ToolDef[]): Promise<LlmTurn>;
}

export const CONTEXT_SENTINEL = "NEXTMOVE_CONTEXT_JSON:";
