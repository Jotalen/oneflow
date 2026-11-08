"use client";
import { useBank } from "./BankProvider";

/** Shown by pages while the persona's bank loads (or failed with no cache). */
export function Loading() {
  const { error, loading, refresh } = useBank();
  if (error && !loading) {
    return (
      <div className="panel p-6">
        <h2 className="font-semibold">Couldn&apos;t reach the bank</h2>
        <p className="text-sm text-muted mt-1">{error}</p>
        <button className="btn mt-3" onClick={() => void refresh()}>Try again</button>
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy>
      {Array.from({ length: 8 }, (_, i) => <div key={i} className="panel h-32 animate-pulse" />)}
    </div>
  );
}
