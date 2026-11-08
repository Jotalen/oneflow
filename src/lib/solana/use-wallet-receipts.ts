"use client";

import { useCallback } from "react";
import { useStoredValue } from "@/lib/bank/storedValue";
import { readReceipts, receiptsKey, RECEIPTS_EVENT, type StoredPayment } from "./receipts";

const EMPTY: StoredPayment[] = [];

export function useWalletReceipts(owner: string) {
  const parse = useCallback((raw: string | null) => readReceipts({ getItem: () => raw }, owner), [owner]);
  return useStoredValue(receiptsKey(owner), RECEIPTS_EVENT, parse, EMPTY);
}
