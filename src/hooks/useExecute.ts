"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RankedMove } from "@/lib/engine/moves/rank";
import { useEventFeed } from "./useEventFeed";

export interface Receipt { moveId: string; title: string; ok: boolean; simulated: boolean; txIds: string[]; receipt: string[]; error?: string; settled: boolean }
const REFRESH_FALLBACK_MS = 15_000;
const SIMULATED_REFRESH_MS = 1_200;

/** Accept a move: POST /api/execute, then refresh when its transactions complete (or after a fallback). */
export function useExecute(personaId: string, refresh: () => Promise<void>, hasKey: boolean) {
  const [accepting, setAccepting] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const { events } = useEventFeed(hasKey);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    const completed = new Set(events.filter((e) => e.type === "transaction.completed").map((e) => e.tx_id));
    setReceipts((prev) => {
      let changed = false;
      const next = prev.map((r) => {
        if (r.settled || r.txIds.length === 0 || !r.txIds.every((id) => completed.has(id))) return r;
        changed = true;
        return { ...r, settled: true };
      });
      if (changed) void refresh();
      return changed ? next : prev;
    });
  }, [events, refresh]);

  const accept = useCallback(async (move: RankedMove) => {
    setAccepting(move.id);
    try {
      const res = await fetch("/api/execute", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ persona: personaId, moveId: move.id }) });
      const json = await res.json();
      const r: Receipt = { moveId: move.id, title: move.title, ok: !!json.ok, simulated: !!json.simulated, txIds: json.txIds ?? [], receipt: json.receipt ?? [], error: json.error, settled: !!json.simulated || (json.txIds ?? []).length === 0 };
      setReceipts((prev) => [r, ...prev].slice(0, 5));
      if (r.ok) timers.current.push(setTimeout(() => void refresh(), r.simulated ? SIMULATED_REFRESH_MS : REFRESH_FALLBACK_MS));
    } catch (e) {
      setReceipts((prev) => [{ moveId: move.id, title: move.title, ok: false, simulated: false, txIds: [], receipt: [], error: e instanceof Error ? e.message : "network error", settled: true }, ...prev]);
    } finally {
      setAccepting(null);
    }
  }, [personaId, refresh]);

  return { accept, accepting, receipts };
}
