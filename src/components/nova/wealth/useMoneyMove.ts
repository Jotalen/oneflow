"use client";
import { useCallback, useState } from "react";
import type { TransferResult } from "@/components/nova/BankProvider";

/** Tracks the last result of an async money move for inline display. */
export function useMoneyMove() {
  const [result, setResult] = useState<TransferResult | null>(null);
  const [okText, setOkText] = useState("");
  const run = useCallback(async (fn: () => Promise<TransferResult>, successText: string) => {
    setResult(null);
    const r = await fn();
    setOkText(successText);
    setResult(r);
    return r;
  }, []);
  return { result, okText, run, clear: () => setResult(null) };
}
