"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type View = "customer" | "tfs";
const Ctx = createContext<{ view: View; setView: (v: View) => void }>({ view: "customer", setView: () => {} });
const KEY = "nm:view";

export function ViewProvider({ children }: { children: ReactNode }) {
  const [view, setViewState] = useState<View>("customer");
  useEffect(() => { try { const v = localStorage.getItem(KEY); if (v === "tfs" || v === "customer") setViewState(v); } catch { /* ignore */ } }, []);
  const setView = (v: View) => { setViewState(v); try { localStorage.setItem(KEY, v); } catch { /* ignore */ } };
  return <Ctx.Provider value={{ view, setView }}>{children}</Ctx.Provider>;
}

export const useView = () => useContext(Ctx);

export function ViewToggle() {
  const { view, setView } = useView();
  return (
    <div role="tablist" aria-label="View" className="glass flex p-0.5 text-xs">
      {(["customer", "tfs"] as const).map((v) => (
        <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`px-2.5 py-1 rounded-full ${view === v ? "bg-line font-semibold" : "text-muted"}`}>
          {v === "customer" ? "Customer" : "TFS view"}
        </button>
      ))}
    </div>
  );
}
