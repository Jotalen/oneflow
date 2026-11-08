"use client";
import { useCallback, useEffect, useState } from "react";
import type { Cents } from "@/lib/money";

/**
 * Savings goals. Nessie has no goal object, so goals are envelopes inside the persona's real
 * savings account, stored per persona in localStorage. "Add money" moves real money
 * checking → savings in Nessie (/api/transfer) and credits the envelope.
 */
export interface Goal { id: string; name: string; target: Cents; saved: Cents; monthly: Cents; createdAt: string; history: { date: string; amount: Cents; note: string }[] }
const KEY = (persona: string) => `nova:goals:${persona}`;

function read(persona: string): Goal[] {
  try { const raw = localStorage.getItem(KEY(persona)); return raw ? (JSON.parse(raw) as Goal[]) : []; } catch { return []; }
}
function write(persona: string, goals: Goal[]) {
  try { localStorage.setItem(KEY(persona), JSON.stringify(goals)); } catch { /* storage unavailable */ }
  window.dispatchEvent(new CustomEvent("nova:goals", { detail: persona }));
}

export function useGoals(persona: string) {
  const [goals, setGoals] = useState<Goal[]>([]);
  useEffect(() => {
    setGoals(read(persona));
    const on = (e: Event) => { if ((e as CustomEvent).detail === persona) setGoals(read(persona)); };
    window.addEventListener("nova:goals", on);
    return () => window.removeEventListener("nova:goals", on);
  }, [persona]);

  const add = useCallback((g: Omit<Goal, "id" | "createdAt" | "history" | "saved">) => {
    const today = new Date().toISOString().slice(0, 10);
    write(persona, [...read(persona), { ...g, saved: 0, id: `g${Date.now()}`, createdAt: today, history: [] }]);
  }, [persona]);
  const credit = useCallback((id: string, amount: Cents, note: string) => {
    const today = new Date().toISOString().slice(0, 10);
    write(persona, read(persona).map((g) => (g.id === id ? { ...g, saved: g.saved + amount, history: [{ date: today, amount, note }, ...g.history] } : g)));
  }, [persona]);
  const update = useCallback((id: string, patch: Partial<Pick<Goal, "name" | "target" | "monthly">>) => {
    write(persona, read(persona).map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }, [persona]);
  const remove = useCallback((id: string) => write(persona, read(persona).filter((g) => g.id !== id)), [persona]);
  return { goals, add, credit, update, remove };
}
