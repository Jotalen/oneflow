"use client";
import { useCallback, useMemo } from "react";
import { useStored } from "@/components/nova/everyday/useStored";
import { useStoredValue, writeStored } from "@/lib/bank/storedValue";
import { effectiveOverrides, parsePlan, resolvePlan, type BudgetPlan } from "@/lib/bank/budgetPlan";
import type { BudgetOverrides } from "@/lib/bank/everyday";
import type { Budget, LedgerTxn } from "@/lib/bank/view";

const PLAN_EVENT = "nova:budget-plan";
const EMPTY_OVERRIDES: BudgetOverrides = {};

/**
 * The persona's budget plan (mode + both sets of amounts), saved in localStorage on this device.
 * Saving also writes the effective limits to the older `nova:budget:<id>` key so screens that
 * still read plain overrides (e.g. the Solana budget preview) show the same numbers.
 */
export function useBudgetPlan(personaId: string): [BudgetPlan, (next: BudgetPlan, suggested: Budget, ledger: LedgerTxn[]) => void] {
  const key = `nova:budget-plan:${personaId}`;
  const stored = useStoredValue<BudgetPlan | null>(key, PLAN_EVENT, parsePlan, null);
  const [legacy, setLegacy] = useStored<BudgetOverrides>("budget", personaId, EMPTY_OVERRIDES);
  const plan = useMemo(() => resolvePlan(stored, legacy), [stored, legacy]);
  const save = useCallback((next: BudgetPlan, suggested: Budget, ledger: LedgerTxn[]) => {
    writeStored(key, PLAN_EVENT, next);
    setLegacy(effectiveOverrides(next, suggested, ledger));
  }, [key, setLegacy]);
  return [plan, save];
}
