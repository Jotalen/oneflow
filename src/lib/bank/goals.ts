"use client";
import { useCallback } from "react";
import { useStoredValue, writeStored } from "./storedValue";
import type { Cents } from "@/lib/money";

/**
 * Savings goals. Nessie has no goal object, so goals are envelopes inside the persona's real
 * savings account, stored per persona in localStorage. "Add money" moves real money
 * checking → savings in Nessie (/api/transfer) and credits the envelope.
 */
export interface Goal { id: string; name: string; target: Cents; saved: Cents; monthly: Cents; createdAt: string; history: { date: string; amount: Cents; note: string }[] }
const KEY = (persona: string) => `nova:goals:${persona}`;
const EVT = "nova:goals";
const NO_GOALS: Goal[] = [];
const parseGoals = (raw: string | null): Goal[] => (raw ? (JSON.parse(raw) as Goal[]) : NO_GOALS);

function read(persona: string): Goal[] {
  try { return parseGoals(localStorage.getItem(KEY(persona))); } catch { return NO_GOALS; }
}
function write(persona: string, goals: Goal[]) {
  writeStored(KEY(persona), EVT, goals);
}

export function useGoals(persona: string) {
  const goals = useStoredValue(KEY(persona), EVT, parseGoals, NO_GOALS);

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
