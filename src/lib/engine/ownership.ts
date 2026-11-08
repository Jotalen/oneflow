import type { PersonaIds } from "./execute";

/** True when the transaction touches one of this persona's seeded accounts. */
export function txBelongsTo(tx: { payer_id?: string | null; payee_id?: string | null; account_id?: string | null }, ids: Partial<PersonaIds>): boolean {
  const mine = new Set([ids.checkingId, ids.savingsId, ids.cardId, ids.cdId].filter(Boolean));
  return [tx.payer_id, tx.payee_id, tx.account_id].some((a) => !!a && mine.has(a));
}

export const personaAccountIds = (ids: Partial<PersonaIds>): string[] => [ids.checkingId, ids.savingsId, ids.cardId, ids.cdId].filter((x): x is string => !!x);
