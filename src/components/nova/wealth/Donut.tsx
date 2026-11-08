/** Progress ring (SVG). */
const R = 42;
const C = 2 * Math.PI * R;

export function Donut({ pct, size = 140, label }: { pct: number; size?: number; label?: string }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={label ?? `${Math.round(p)}%`}>
      <circle cx="50" cy="50" r={R} fill="none" stroke="var(--line)" strokeWidth="10" />
      <circle cx="50" cy="50" r={R} fill="none" stroke="var(--fg)" strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${(p / 100) * C} ${C}`} transform="rotate(-90 50 50)" />
      <text x="50" y="55" textAnchor="middle" fontSize="16" fontWeight="600" fill="var(--fg)">{Math.round(p)}%</text>
    </svg>
  );
}
