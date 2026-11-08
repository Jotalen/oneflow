/**
 * Pure helpers for count-up numbers: find the first number in a display string
 * ("$28,617.46", "721 · Good", "−$12.00") and re-format any value in its exact shape.
 * The sign and currency symbol stay in the prefix, so the counted value is never negative.
 */
export interface CountUpParts {
  /** Text before the number, e.g. "−$". */
  prefix: string;
  /** The number exactly as written, e.g. "28,617.46". */
  token: string;
  value: number;
  decimals: number;
  /** Whether the token uses thousands separators. */
  grouped: boolean;
  /** Text after the number, e.g. " months". */
  suffix: string;
}

const FIRST_NUMBER = /\d[\d,]*(?:\.\d+)?/;
const GROUP_EVERY_3 = /\B(?=(\d{3})+(?!\d))/g;

function formatToken(parts: Pick<CountUpParts, "decimals" | "grouped">, n: number): string {
  const [whole, frac] = n.toFixed(parts.decimals).split(".");
  const wholeOut = parts.grouped ? whole.replace(GROUP_EVERY_3, ",") : whole;
  return frac === undefined ? wholeOut : `${wholeOut}.${frac}`;
}

/** The first number in `text`, or null when there is nothing to count or it can't be reproduced exactly. */
export function parseCountUp(text: string): CountUpParts | null {
  const match = FIRST_NUMBER.exec(text);
  if (!match) return null;
  const token = match[0];
  const decimals = token.includes(".") ? token.length - token.indexOf(".") - 1 : 0;
  const grouped = token.includes(",");
  const value = Number(token.replace(/,/g, ""));
  if (!Number.isFinite(value) || value <= 0) return null;
  if (formatToken({ decimals, grouped }, value) !== token) return null;
  return { prefix: text.slice(0, match.index), token, value, decimals, grouped, suffix: text.slice(match.index + token.length) };
}

/** Just the number part for an in-between value, clamped to 0..value. */
export function formatCountUpToken(parts: CountUpParts, n: number): string {
  if (n >= parts.value) return parts.token;
  return formatToken(parts, Math.max(0, n));
}

/** The whole display string for an in-between value; at `parts.value` it equals the original text. */
export function formatCountUp(parts: CountUpParts, n: number): string {
  return `${parts.prefix}${formatCountUpToken(parts, n)}${parts.suffix}`;
}
