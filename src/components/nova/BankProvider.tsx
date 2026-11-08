"use client";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { usePersona, type PersonaSummary } from "@/components/PersonaProvider";
import { useProfile } from "@/hooks/useProfile";
import { useExecute, type Receipt } from "@/hooks/useExecute";
import { useLiveBalance } from "@/hooks/useLiveBalance";
import { buildBankView, type BankView } from "@/lib/bank/view";
import type { Analysis } from "@/lib/engine/analyze";
import type { RankedMove } from "@/lib/engine/moves/rank";
import type { Cents } from "@/lib/money";

export type AccountKind = "checking" | "savings" | "card";
export interface TransferResult { ok: boolean; simulated?: boolean; error?: string; description?: string }

interface BankCtx {
  personaId: string;
  persona?: PersonaSummary;
  analysis: Analysis | null;
  view: BankView | null;
  loading: boolean;
  offline: boolean;
  error: string | null;
  live: boolean;
  refresh: () => Promise<void>;
  accept: (m: RankedMove) => Promise<void>;
  accepting: string | null;
  receipts: Receipt[];
  transfer: (from: "checking" | "savings", to: AccountKind, amountCents: Cents, purpose?: string) => Promise<TransferResult>;
  transferring: boolean;
}

const Ctx = createContext<BankCtx | null>(null);
const REFRESH_AFTER_TRANSFER_MS = 1_500;

/** One fetch per persona shared by every page; derived OneFlow numbers memoized. */
export function BankProvider({ children }: { children: ReactNode }) {
  const { personaId, ready, personas } = usePersona();
  const { data, loading, offline, error, refresh } = useProfile(personaId, ready);
  const live = !!data && data.profile.source === "nessie";
  const { accept, accepting, receipts } = useExecute(personaId, refresh, live);
  useLiveBalance(data, live, refresh);
  const [transferring, setTransferring] = useState(false);
  const view = useMemo(() => (data ? buildBankView(data) : null), [data]);

  const transfer = useCallback(async (from: "checking" | "savings", to: AccountKind, amountCents: Cents, purpose?: string): Promise<TransferResult> => {
    setTransferring(true);
    try {
      const res = await fetch("/api/transfer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ persona: personaId, from, to, amountCents: Math.round(amountCents), purpose }) });
      const json = (await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))) as TransferResult;
      if (json.ok) setTimeout(() => void refresh(), REFRESH_AFTER_TRANSFER_MS);
      return json;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "network error" };
    } finally {
      setTransferring(false);
    }
  }, [personaId, refresh]);

  const value = useMemo<BankCtx>(() => ({
    personaId, persona: personas.find((p) => p.id === personaId), analysis: data, view, loading, offline, error, live,
    refresh, accept, accepting, receipts, transfer, transferring,
  }), [personaId, personas, data, view, loading, offline, error, live, refresh, accept, accepting, receipts, transfer, transferring]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBank(): BankCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useBank outside BankProvider");
  return c;
}

/** Page guard: renders a loading/error state until analysis + view exist. */
export function useReadyBank(): (BankCtx & { analysis: Analysis; view: BankView }) | null {
  const b = useBank();
  return b.analysis && b.view ? (b as BankCtx & { analysis: Analysis; view: BankView }) : null;
}
