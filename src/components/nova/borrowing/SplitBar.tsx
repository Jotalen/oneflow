import { fmtUSD, type Cents } from "@/lib/money";

/** Two-part bar: solid = principal, hatched = interest. */
export function SplitBar({ principal, interest }: { principal: Cents; interest: Cents }) {
  const total = principal + interest;
  const pct = total > 0 ? (principal / total) * 100 : 0;
  return (
    <div className="flex h-3 rounded-full overflow-hidden bg-line" role="img" aria-label={`${Math.round(pct)}% principal, ${Math.round(100 - pct)}% interest`}>
      <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
      <div className="h-full flex-1" style={{ backgroundImage: "repeating-linear-gradient(45deg, var(--muted) 0 1px, transparent 1px 5px)" }} />
    </div>
  );
}

export function LegendRow({ label, cents, hatched }: { label: string; cents: Cents; hatched?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-line last:border-0 text-sm">
      <span className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-sm ${hatched ? "border border-muted" : "bg-ink"}`} aria-hidden />
        {label}
      </span>
      <span className="font-semibold money">{fmtUSD(cents)}</span>
    </div>
  );
}
