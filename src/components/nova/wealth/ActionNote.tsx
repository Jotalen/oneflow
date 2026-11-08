"use client";
import type { TransferResult } from "@/components/nova/BankProvider";

/** Inline outcome of a money move: success, simulated (no live bank), or the error. */
export function ActionNote({ result, okText }: { result: TransferResult | null; okText: string }) {
  if (!result) return null;
  if (!result.ok) return <p role="status" className="text-xs text-bad mt-2">Couldn&apos;t complete: {result.error ?? "unknown error"}</p>;
  return (
    <p role="status" className="text-xs text-good mt-2">
      {okText}{result.simulated ? " (simulated: demo bank is offline, no real money moved)" : ""}
    </p>
  );
}
