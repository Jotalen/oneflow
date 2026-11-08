/** Integer cents everywhere (ADR-006). Convert only at boundaries. */
export type Cents = number;

export function toCents(dollars: number): Cents {
  return Math.round(dollars * 100);
}

export function toDollars(cents: Cents): number {
  return Math.round(cents) / 100;
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtUSD(cents: Cents): string {
  return usd.format(toDollars(cents));
}

/** Parse a dollar string ("$1,234.50", "1234.5", "", "n/a") to cents or null. */
export function parseCents(raw: unknown): Cents | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).replace(/[$,\s]/g, "");
  if (s === "" || s.toLowerCase() === "n/a" || s.toLowerCase() === "na") return null;
  const n = Number(s);
  return Number.isFinite(n) ? toCents(n) : null;
}

/** Chart axis label in thousands: $0.5k / $17.5k / $18k. One decimal so nearby ticks never repeat. */
export function fmtAxisK(cents: Cents): string {
  return `$${(cents / 100_000).toFixed(1).replace(/\.0$/, "")}k`;
}
