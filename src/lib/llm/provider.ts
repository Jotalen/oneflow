export type Role = "system" | "user" | "assistant" | "tool";
/** `signature`: opaque provider token that must be echoed back with the call (Gemini 3.x thought_signature). */
export interface ToolCall { id: string; name: string; args: Record<string, unknown>; signature?: string }
export interface Msg { role: Role; content: string; toolCalls?: ToolCall[]; toolCallId?: string; name?: string }
export interface ToolDef { name: string; description: string; parameters: { type: "object"; properties: Record<string, { type: string; description?: string }>; required?: string[] } }
export interface LlmTurn { text?: string; toolCalls?: ToolCall[] }

export interface LlmProvider {
  readonly name: "stub" | "gemini" | "openrouter";
  chat(messages: Msg[], tools: ToolDef[]): Promise<LlmTurn>;
}

export const CONTEXT_SENTINEL = "NEXTMOVE_CONTEXT_JSON:";
