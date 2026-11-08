const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Small "NOV / 9" calendar square used in bill lists. */
export function DateChip({ iso }: { iso: string }) {
  const [, m, d] = iso.split("-").map(Number);
  return (
    <div className="h-10 w-10 shrink-0 rounded-lg bg-surface-2 border border-line grid place-items-center leading-none" aria-hidden>
      <span className="text-[0.55rem] text-muted">{MONTHS[m - 1]}</span>
      <span className="text-sm font-semibold">{d}</span>
    </div>
  );
}
