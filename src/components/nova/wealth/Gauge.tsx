/** Semicircle score gauge, 300–850. */
const MIN = 300;
const MAX = 850;
const R = 80;
const LEN = Math.PI * R;

export function Gauge({ score, label }: { score: number; label: string }) {
  const frac = Math.max(0, Math.min(1, (score - MIN) / (MAX - MIN)));
  const arc = `M 20 100 A ${R} ${R} 0 0 1 180 100`;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 115" className="w-full max-w-[260px]" role="img" aria-label={`Estimated score ${score}, ${label}`}>
        <path d={arc} fill="none" stroke="var(--line)" strokeWidth="16" strokeLinecap="round" />
        <path d={arc} fill="none" stroke="var(--fg)" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${frac * LEN} ${LEN}`} />
        <text x="100" y="88" textAnchor="middle" fontSize="34" fontWeight="700" fill="var(--fg)">{score}</text>
        <text x="100" y="108" textAnchor="middle" fontSize="12" fill="var(--muted)">{label}</text>
      </svg>
      <div className="flex justify-between w-full max-w-[260px] text-xs text-muted px-1"><span>{MIN}</span><span>{MAX}</span></div>
    </div>
  );
}
