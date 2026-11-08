"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { usePersona } from "@/components/PersonaProvider";
import { PendingGuard } from "@/components/PendingGuard";
import { usePendingGuard } from "@/hooks/usePendingGuard";
import { EventFeed } from "@/components/EventFeed";
import { useBank } from "./BankProvider";
import { SPRING } from "@/lib/motion";

/** Both panels open under a button at their top-right corner, so they grow from there. */
const POP = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: SPRING,
  style: { transformOrigin: "top right" },
} as const;

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

/** Notifications (live Nessie events + pending-transaction guard), and the customer menu. */
export function TopActions() {
  const { personaId, setPersonaId, personas } = usePersona();
  const { analysis, live, offline, receipts } = useBank();
  const guard = usePendingGuard(personaId, live, analysis?.profile.accounts.map((a) => a.id) ?? []);
  const [bell, setBell] = useState(false);
  const [menu, setMenu] = useState(false);
  const bellRef = useOutside(bell, () => setBell(false));
  const menuRef = useOutside(menu, () => setMenu(false));
  const me = personas.find((p) => p.id === personaId);
  const unread = receipts.filter((r) => !r.settled).length;

  return (
    <div className="flex items-center gap-2">
      <div className="relative" ref={bellRef}>
        <button className="h-9 w-9 rounded-full border border-line bg-surface grid place-items-center relative" aria-label="Notifications" aria-expanded={bell} onClick={() => setBell((v) => !v)}>
          <span aria-hidden>🔔</span>
          {(unread > 0 || offline) && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-bad" />}
        </button>
        <AnimatePresence>
        {bell && (
          <motion.div key="bell" {...POP} className="fixed inset-x-2 top-16 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-[26rem] z-40 space-y-3 max-h-[75vh] overflow-auto rounded-2xl bg-bg p-2 border border-line shadow-xl">
            {offline && <div className="panel p-3 text-sm">Showing an offline snapshot. Live bank actions are simulated.</div>}
            {analysis && <PendingGuard hasKey={live} guard={guard} />}
            <EventFeed hasKey={live} />
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      <div className="relative" ref={menuRef}>
        <button className="flex items-center gap-1" aria-label={`${me?.name[0] ?? "?"}, switch customer`} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
          <span className="h-9 w-9 rounded-full bg-surface-2 border border-line grid place-items-center text-sm font-semibold">{me?.name[0] ?? "?"}</span>
          <span aria-hidden className="text-muted text-xs">▾</span>
        </button>
        <AnimatePresence>
        {menu && (
          <motion.div key="menu" {...POP} className="absolute right-0 mt-2 w-64 z-40 panel p-2 shadow-xl max-h-[70vh] overflow-auto">
            <div className="px-2 py-1 text-[0.7rem] uppercase tracking-wider text-muted">Customers</div>
            {personas.map((p) => (
              <button key={p.id} onClick={() => { setPersonaId(p.id); setMenu(false); }}
                className={`w-full text-left px-2 py-1.5 rounded-lg text-sm hover:bg-surface-2 flex justify-between ${p.id === personaId ? "bg-surface-2 font-semibold" : ""}`}>
                <span>{p.name}, {p.age}</span><span className="text-muted text-xs">{p.id}</span>
              </button>
            ))}
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
}
