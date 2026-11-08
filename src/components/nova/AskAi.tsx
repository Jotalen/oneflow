"use client";
import { useId, useRef, useState, type FormEvent } from "react";
import { RichText } from "./RichText";
import { useBank } from "@/components/nova/BankProvider";

/**
 * Shared "Ask AI" button + dialog. `<AskAi topic="safety_net" />` answers straight away;
 * `<AskAi topic="which_card" />` first asks what the customer is about to buy.
 * Numbers come from /api/assist, which computes them in code; the model only words them.
 */
export type AskAiTopic = "safety_net" | "which_card";
type Source = "gemini" | "openrouter" | "offline";
interface Answer { text: string; source: Source }
type Status = { kind: "idle" } | { kind: "loading" } | { kind: "done"; answer: Answer } | { kind: "error"; error: string };

interface AskAiProps {
  topic: AskAiTopic;
  /** safety_net only: the customer's own monthly essentials (cents by essential key). */
  essentialsOverrides?: Record<string, number>;
}

const COPY: Record<AskAiTopic, { button: string; title: string; aria: string }> = {
  safety_net: { button: "Ask AI", title: "Make your money last longer", aria: "Ask AI how to make my money last longer" },
  which_card: { button: "Which card?", title: "Which card should I use?", aria: "Ask AI which card to use for a purchase" },
};
const CHIPS = ["Groceries", "Gas", "Dining", "Travel", "Online shopping", "A big purchase"] as const;
const MAX_QUESTION = 300;
const SOURCE_NOTE: Record<Source, string> = {
  gemini: "Worded by Gemini from numbers OneFlow calculated. The AI didn't do any math.",
  openrouter: "Worded by an AI model (via OpenRouter) from numbers OneFlow calculated. The AI didn't do any math.",
  offline: "OneFlow's built-in answer, from the same numbers. No AI was needed.",
};

async function ask(body: { persona: string; topic: AskAiTopic; question?: string; essentialsOverrides?: Record<string, number> }): Promise<Status> {
  try {
    const res = await fetch("/api/assist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => null)) as ({ ok: boolean; error?: string } & Partial<Answer>) | null;
    if (!res.ok || !json?.ok || !json.text || !json.source) return { kind: "error", error: json?.error ?? `Something went wrong (${res.status}).` };
    return { kind: "done", answer: { text: json.text, source: json.source } };
  } catch {
    return { kind: "error", error: "Couldn't reach OneFlow. Check your connection and try again." };
  }
}

/** Small four-point sparkle (our own shape, not a brand logo). */
export function Sparkle({ className = "h-3.5 w-3.5" }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f8df7" />
          <stop offset="0.55" stopColor="#9b72f2" />
          <stop offset="1" stopColor="#e8738f" />
        </linearGradient>
      </defs>
      <path fill={`url(#${id})`} d="M12 2c.7 5.6 4.4 9.3 10 10-5.6.7-9.3 4.4-10 10-.7-5.6-4.4-9.3-10-10 5.6-.7 9.3-4.4 10-10Z" />
    </svg>
  );
}

function AnswerView({ answer }: { answer: Answer }) {
  const [lead, ...rest] = answer.text.split("\n").filter((l) => l.trim());
  return (
    <div className="mt-4 space-y-3" role="status" aria-live="polite">
      <div className="rounded-xl bg-surface-2 p-3 text-sm leading-relaxed">
        <RichText text={lead} className="font-semibold" />
        {rest.length > 0 && <RichText text={rest.join("\n")} className="mt-2" />}
      </div>
      <p className="text-xs text-muted">{SOURCE_NOTE[answer.source]} Not financial advice.</p>
    </div>
  );
}

/** Keyed by customer so switching persona starts a fresh dialog (no answer about the previous customer). */
export function AskAi(props: AskAiProps) {
  const { personaId } = useBank();
  return <AskAiDialog key={personaId} personaId={personaId} {...props} />;
}

function AskAiDialog({ topic, essentialsOverrides, personaId }: AskAiProps & { personaId: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [question, setQuestion] = useState("");
  const [askedFor, setAskedFor] = useState<string | null>(null);
  const copy = COPY[topic];

  const run = async (q?: string) => {
    setStatus({ kind: "loading" });
    setStatus(await ask({ persona: personaId, topic, ...(q ? { question: q } : {}), ...(essentialsOverrides ? { essentialsOverrides } : {}) }));
  };

  const open = () => {
    ref.current?.showModal();
    if (topic !== "safety_net") return;
    const key = `${personaId}:${JSON.stringify(essentialsOverrides ?? {})}`;
    if (status.kind === "loading" || (key === askedFor && status.kind === "done")) return;
    setAskedFor(key);
    void run();
  };
  const close = () => ref.current?.close();
  const submit = (q: string) => {
    const text = q.trim().slice(0, MAX_QUESTION);
    if (!text) return setStatus({ kind: "error", error: "Tell us what you're buying, or tap one of the options." });
    setQuestion(text);
    void run(text);
  };
  const onSubmit = (e: FormEvent) => { e.preventDefault(); submit(question); };
  const busy = status.kind === "loading";

  return (
    <>
      <button type="button" className="btn h-8 px-3 text-xs" onClick={open} aria-haspopup="dialog" aria-label={copy.aria}>
        <Sparkle />{copy.button}
      </button>
      <dialog ref={ref} aria-labelledby={titleId} className="panel m-auto w-[min(32rem,calc(100vw-2rem))] max-h-[85vh] overflow-y-auto p-5 text-fg backdrop:bg-black/40">
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-semibold text-lg flex items-center gap-2"><Sparkle className="h-4 w-4" />{copy.title}</h2>
          <button type="button" className="btn h-8 w-8 px-0" aria-label="Close" onClick={close}>✕</button>
        </div>
        {topic === "which_card" && (
          <form onSubmit={onSubmit} className="mt-3 space-y-2">
            <label className="text-sm font-semibold block" htmlFor={`${titleId}-q`}>What are you about to buy?</label>
            <div className="flex gap-2">
              <input id={`${titleId}-q`} className="min-w-0 flex-1 rounded-full border border-line bg-surface px-3 py-1.5 text-sm" value={question}
                maxLength={MAX_QUESTION} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. dinner with friends, $80" />
              <button type="submit" className="btn btn-primary text-sm" disabled={busy}>Ask</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CHIPS.map((c) => <button key={c} type="button" className="chip hover:border-fg" disabled={busy} onClick={() => submit(c)}>{c}</button>)}
            </div>
          </form>
        )}
        {busy && <p className="mt-4 text-sm text-muted" role="status">Working out your numbers…</p>}
        {status.kind === "error" && (
          <div className="mt-4 text-sm">
            <p role="alert" className="text-bad">{status.error}</p>
            {topic === "safety_net" && <button type="button" className="btn text-sm mt-2" onClick={() => void run()}>Try again</button>}
          </div>
        )}
        {status.kind === "done" && <AnswerView answer={status.answer} />}
      </dialog>
    </>
  );
}
