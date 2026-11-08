"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { usePersona } from "@/components/PersonaProvider";
import { PendingGuard } from "@/components/PendingGuard";
import { EventFeed } from "@/components/EventFeed";
import { useBank } from "./BankProvider";

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, close]);
  return ref;
}

/** Search, notifications (live Nessie events + pending-transaction guard), and the customer menu. */
export function TopActions() {
  const router = useRouter();
  const { personaId, setPersonaId, personas } = usePersona();
  const { analysis, live, offline, receipts } = useBank();
  const [q, setQ] = useState("");
  const [bell, setBell] = useState(false);
  const [menu, setMenu] = useState(false);
  const bellRef = useOutside(bell, () => setBell(false));
  const menuRef = useOutside(menu, () => setMenu(false));
  const me = personas.find((p) => p.id === personaId);
  const unread = receipts.filter((r) => !r.settled).length;

  const onSearch = (e: FormEvent) => { e.preventDefault(); router.push(`/transactions${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`); };

  return (
    <div className="flex items-center gap-2">
      <form onSubmit={onSearch} className="hidden md:block" role="search">
        <label className="flex items-center gap-2 h-9 w-56 rounded-full border border-line bg-surface px-3 text-sm">
          <span aria-hidden className="text-muted">⌕</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search transactions" className="bg-transparent outline-none w-full placeholder:text-muted" />
        </label>
      </form>

      <div className="relative" ref={bellRef}>
        <button className="h-9 w-9 rounded-full border border-line bg-surface grid place-items-center relative" aria-label="Notifications" aria-expanded={bell} onClick={() => setBell((v) => !v)}>
          <span aria-hidden>🔔</span>
          {(unread > 0 || offline) && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-bad" />}
        </button>
        {bell && (
          <div className="absolute right-0 mt-2 w-[min(92vw,26rem)] z-40 space-y-3 max-h-[75vh] overflow-auto rounded-2xl bg-bg p-2 border border-line shadow-xl">
            {offline && <div className="panel p-3 text-sm">Showing an offline snapshot. Live bank actions are simulated.</div>}
            {analysis && <PendingGuard personaId={personaId} hasKey={live} accountIds={analysis.profile.accounts.map((a) => a.id)} />}
            <EventFeed hasKey={live} />
          </div>
        )}
      </div>

      <div className="relative" ref={menuRef}>
        <button className="flex items-center gap-1" aria-label="Switch customer" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
          <span className="h-9 w-9 rounded-full bg-surface-2 border border-line grid place-items-center text-sm font-semibold">{me?.name[0] ?? "?"}</span>
          <span aria-hidden className="text-muted text-xs">▾</span>
        </button>
        {menu && (
          <div className="absolute right-0 mt-2 w-64 z-40 panel p-2 shadow-xl max-h-[70vh] overflow-auto">
            <div className="px-2 py-1 text-[0.7rem] uppercase tracking-wider text-muted">Demo customers</div>
            {personas.map((p) => (
              <button key={p.id} onClick={() => { setPersonaId(p.id); setMenu(false); }}
                className={`w-full text-left px-2 py-1.5 rounded-lg text-sm hover:bg-surface-2 flex justify-between ${p.id === personaId ? "bg-surface-2 font-semibold" : ""}`}>
                <span>{p.name}, {p.age}</span><span className="text-muted text-xs">{p.id}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
