"use client";
import { useState } from "react";
import { Card } from "./ui/Card";

interface Turn { role: "user" | "assistant"; content: string; toolTrace?: string[]; provider?: string }
interface Props { personaId: string; onBrief?: (brief: string) => void }

const SUGGESTIONS = ["What should I do about my car?", "Can I afford this?", "What's the risk if I do nothing?"];

export function CoachPanel({ personaId, onBrief }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<"chat" | "analyze" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(mode: "chat" | "analyze", message?: string) {
    setBusy(mode);
    setError(null);
    const history = turns.map((t) => ({ role: t.role, content: t.content }));
    if (mode === "chat" && message) setTurns((t) => [...t, { role: "user", content: message }]);
    try {
      const res = await fetch("/api/coach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ persona: personaId, mode, message, history }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.hint ?? json.error ?? `HTTP ${res.status}`);
      const content: string = mode === "analyze" ? json.brief : json.text;
      setTurns((t) => [...t, { role: "assistant", content, toolTrace: json.toolTrace, provider: json.provider }]);
      if (mode === "analyze") onBrief?.(content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "coach failed");
    } finally {
      setBusy(null);
    }
  }

  const last = [...turns].reverse().find((t) => t.role === "assistant");
  return (
    <Card
      eyebrow="Coach"
      title="Ask, or press AI analyze"
      right={
        <div className="flex items-center gap-2">
          {last?.provider && <span className="chip" title="LLM provider">{({ stub: "Built-in narrator", gemini: "Gemini", openrouter: "OpenRouter" } as Record<string, string>)[last.provider] ?? last.provider}</span>}
          <button type="button" onClick={() => void send("analyze")} disabled={busy !== null} className="glass px-3 py-1.5 text-sm font-semibold hover:border-accent disabled:opacity-50">
            {busy === "analyze" ? "Analyzing…" : "✦ AI analyze"}
          </button>
        </div>
      }
    >
      <div className="space-y-3 max-h-80 overflow-auto pr-1">
        {turns.length === 0 && <p className="text-sm text-muted">The coach narrates tool results from the engine. It never does arithmetic.</p>}
        {turns.map((t, i) => (
          <div key={i} className={`text-sm whitespace-pre-wrap rounded-xl p-3 ${t.role === "user" ? "bg-surface-2 ml-8" : "bg-surface-2 mr-4"}`}>
            {t.content}
            {t.toolTrace && t.toolTrace.length > 0 && (
              <details className="mt-2 text-[0.7rem] text-muted">
                <summary className="cursor-pointer">tools used ({t.toolTrace.length})</summary>
                <ul className="font-mono mt-1">{t.toolTrace.map((x, j) => <li key={j}>{x}</li>)}</ul>
              </details>
            )}
          </div>
        ))}
        {error && <div className="text-sm text-bad">{error}</div>}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => { e.preventDefault(); const m = input.trim(); if (!m) return; setInput(""); void send("chat", m); }}
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about your next move…" className="glass flex-1 px-3 py-2 text-sm bg-transparent outline-none focus:border-accent" />
        <button type="submit" disabled={busy !== null} className="glass px-3 py-2 text-sm disabled:opacity-50">Send</button>
      </form>
      <div className="mt-2 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => void send("chat", s)} disabled={busy !== null} className="chip hover:border-accent">{s}</button>)}
      </div>
    </Card>
  );
}
