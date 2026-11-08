"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useBank } from "@/components/nova/BankProvider";
import { RichText } from "@/components/nova/RichText";
import { NavIcon } from "@/components/nova/icons";
import { suggestPrompts, topicOf, type Topic } from "@/lib/chat/suggestions";
import type { AutoBuyProposal } from "@/lib/chat/facts";
import { SPRING } from "@/lib/motion";
import { GeminiMark } from "./GeminiMark";
import { readAutoBuy, saveAutoBuy, setAskAiMode, useChatHistory, type AskAiMode, type ChatMessage } from "./askAiStore";

type PanelMode = Exclude<AskAiMode, "closed">;
const WHO: Record<string, string> = { gemini: "Gemini", openrouter: "AI", stub: "OneFlow" };
const TOPIC_ICON: Record<Topic, string> = { car: "/car", plan: "/day-to-day", solana: "/solana", safety: "/safety-net", other: "/" };

function IconButton({ label, onClick, children, className = "" }: { label: string; onClick: () => void; children: ReactNode; className?: string }) {
  return <button type="button" onClick={onClick} aria-label={label} title={label} className={`grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg ${className}`}>{children}</button>;
}

function Header({ mode }: { mode: PanelMode }) {
  const expanded = mode === "expanded";
  return (
    <header className="flex items-center gap-2 px-3 py-3">
      <IconButton label="Back" onClick={() => setAskAiMode("closed")}>
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12.5 4.5 7 10l5.5 5.5" /></svg>
      </IconButton>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <GeminiMark className="h-5 w-5 shrink-0" />
        <div className="min-w-0 leading-tight">
          <div className="text-sm font-semibold">Ask AI</div>
          <div className="flex items-center gap-1.5 text-[0.7rem] text-muted"><span className="h-1.5 w-1.5 rounded-full bg-good" aria-hidden />Connected to your accounts</div>
        </div>
      </div>
      <IconButton label={expanded ? "Dock to the side" : "Expand"} onClick={() => setAskAiMode(expanded ? "docked" : "expanded")} className="hidden md:grid">
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{expanded ? <path d="M8 3v5H3M12 17v-5h5" /> : <path d="M12 3h5v5M8 17H3v-5M17 3l-5.5 5.5M3 17l5.5-5.5" />}</svg>
      </IconButton>
    </header>
  );
}

/** The logo's three flows merging, drawn while the answer is being prepared. */
function Thinking() {
  return (
    <div className="flex items-center gap-2.5 text-xs text-muted" role="status">
      <svg viewBox="0 0 40 20" className="h-5 w-10" fill="none" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
        {["M2 4 C14 4 16 10 26 10", "M2 10 H26", "M2 16 C14 16 16 10 26 10"].map((d, i) => (
          <motion.path key={d} d={d} stroke="currentColor" initial={{ pathLength: 0, opacity: 0.3 }} animate={{ pathLength: [0, 1, 1], opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }} />
        ))}
        <motion.circle cx="32" cy="10" r="3" fill="#39C27A" animate={{ scale: [0.6, 1, 0.6] }} transition={{ duration: 1.4, repeat: Infinity }} />
      </svg>
      Reading your accounts…
    </div>
  );
}

function ProposalCard({ p, onConfirm, done }: { p: AutoBuyProposal; onConfirm: () => void; done: boolean }) {
  const stats = [["Each payday", p.perPaycheck], ["Per month", p.monthly], ["Starts", p.nextPayday]];
  return (
    <div className="mt-3 rounded-2xl border border-line bg-surface p-3.5">
      <div className="flex items-center gap-2 text-sm font-semibold"><NavIcon href="/solana" className="h-4 w-4 text-accent" />Solana auto-buy · {p.percent}% of each paycheck</div>
      <dl className="mt-2.5 grid grid-cols-3 gap-2">
        {stats.map(([k, v]) => <div key={k}><dt className="text-[0.68rem] text-muted">{k}</dt><dd className="money text-sm font-semibold">{v}</dd></div>)}
      </dl>
      <p className="mt-2 text-[0.7rem] text-muted">You approve each buy in Phantom. Stop anytime.</p>
      <button type="button" className="btn btn-primary mt-3 h-9 w-full" disabled={done} onClick={onConfirm}>{done ? "Auto-buy is on ✓" : "Set up auto-buy"}</button>
    </div>
  );
}

function Message({ m, onConfirm, isSaved }: { m: ChatMessage; onConfirm: (p: AutoBuyProposal) => void; isSaved: (p: AutoBuyProposal) => boolean }) {
  if (m.role === "user") return <p className="ml-10 self-end rounded-2xl rounded-br-sm bg-surface-2 px-3.5 py-2 text-sm">{m.content}</p>;
  return (
    <motion.article initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={SPRING} className="border-l-[3px] border-[#39C27A] pl-3.5">
      <RichText text={m.content} className="text-sm leading-relaxed [&_strong]:money [&_strong]:text-fg" />
      {m.proposal && <ProposalCard p={m.proposal} done={isSaved(m.proposal)} onConfirm={() => onConfirm(m.proposal!)} />}
      {m.provider && <div className="mt-2 flex items-center gap-1 text-[0.68rem] text-muted">{m.provider === "gemini" && <GeminiMark className="h-3 w-3" />}{WHO[m.provider] ?? "OneFlow"} · from your accounts</div>}
    </motion.article>
  );
}

function Suggestions({ items, onPick }: { items: string[]; onPick: (q: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((s) => (
        <button key={s} type="button" onClick={() => onPick(s)} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-left text-sm hover:border-accent-2 hover:bg-accent-soft/40">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><NavIcon href={TOPIC_ICON[topicOf(s)]} className="h-4 w-4" /></span>
          <span className="flex-1">{s}</span>
        </button>
      ))}
    </div>
  );
}

function useAskAiChat() {
  const b = useBank();
  const [messages, save] = useChatHistory(b.personaId);
  const [busy, setBusy] = useState(false);
  // Bumped after saving, so the saved plan is re-read (it survives docking, expanding and reloads).
  const [planVersion, setPlanVersion] = useState(0);
  const plan = useMemo(() => (planVersion >= 0 ? readAutoBuy(b.personaId) : null), [b.personaId, planVersion]);
  const isSaved = (p: AutoBuyProposal) => !!plan && plan.percent === p.percent && plan.startsOn === p.nextPayday;
  const suggestions = useMemo(() => {
    const p = b.analysis?.profile;
    return suggestPrompts({
      contract: p?.contract ? { type: p.contract.type === "lease" ? "lease" : "loan", monthsRemaining: p.contract.monthsRemaining } : null,
      hasCardDebt: !!p?.debts.some((d) => d.kind === "card" && d.balance > 0), safetyNetMonths: b.view?.safetyNet.months ?? 0,
      past: messages.filter((m) => m.role === "user").map((m) => m.content),
    });
  }, [b.analysis, b.view, messages]);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: q }];
    save(next);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ persona: b.personaId, message: q, history: messages.map(({ role, content }) => ({ role, content })) }) });
      const json = (await res.json().catch(() => ({}))) as { text?: string; error?: string; provider?: string; proposal?: AutoBuyProposal };
      save([...next, { role: "assistant", content: json.text ?? json.error ?? "Something went wrong. Try again.", provider: json.provider, proposal: json.proposal }]);
    } catch {
      save([...next, { role: "assistant", content: "I couldn't reach OneFlow. Check your connection and try again." }]);
    } finally {
      setBusy(false);
    }
  }

  function confirm(p: AutoBuyProposal) {
    const saved = saveAutoBuy(b.personaId, p);
    setPlanVersion((v) => v + 1);
    save([...messages, { role: "assistant", content: `Auto-buy is on. Each payday from **${saved.startsOn}**, OneFlow lines up **${saved.perPaycheck}** (${saved.percent}% of your paycheck) for a USDC to SOL buy that you approve in Phantom.` }]);
  }

  return { name: b.persona?.name ?? "there", messages, busy, suggestions, ask, confirm, isSaved };
}

/** Ask AI: answers from the customer's whole account. Every number comes from OneFlow; the model words it. */
export function AskAiPanel({ mode }: { mode: PanelMode }) {
  const c = useAskAiChat();
  const [draft, setDraft] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [c.messages.length, c.busy]);
  const send = () => { void c.ask(draft); setDraft(""); };
  const onSubmit = (e: FormEvent) => { e.preventDefault(); send(); };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <motion.section initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={SPRING} className="flex h-full min-h-0 flex-col bg-surface" aria-label="Ask AI">
      <Header mode={mode} />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4 pt-2">
        {c.messages.length === 0 && (
          <div className="mt-6">
            <h2 className="text-xl font-semibold tracking-tight">{c.name}, what should your money do next?</h2>
            <p className="mt-1.5 text-sm text-muted">I can see your balances, bills, car, rewards and every transaction.</p>
          </div>
        )}
        {c.messages.map((m, i) => <Message key={i} m={m} isSaved={c.isSaved} onConfirm={c.confirm} />)}
        {c.busy ? <Thinking /> : <Suggestions items={c.suggestions} onPick={(q) => void c.ask(q)} />}
        <div ref={end} />
      </div>
      <form onSubmit={onSubmit} className="p-3">
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface-2 p-1.5 pl-3.5 focus-within:border-accent-2">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} rows={1} maxLength={1000} placeholder="Ask about your money" aria-label="Message"
            className="max-h-32 min-h-[2.25rem] flex-1 resize-none bg-transparent py-2 text-sm outline-none" />
          <button type="submit" aria-label="Send" disabled={c.busy || !draft.trim()} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-on-accent disabled:opacity-40">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15V5M5.5 9.5 10 5l4.5 4.5" /></svg>
          </button>
        </div>
      </form>
    </motion.section>
  );
}
