import type { EventItem } from "@/lib/events/poller";

/** One Nessie event as stored in the `nessie_events` hypertable. */
export interface EventRow {
  seq: number;
  createdAt: string;
  type: string;
  accountId: string | null;
  txId: string | null;
  personaId: string | null;
  kind: string | null;
  status: string | null;
  amountCents: number | null;
  balanceCents: number | null;
  deltaCents: number | null;
  decision: string | null;
  decisionSource: string | null;
}

type SeedAccounts = Record<string, { checkingId?: string; savingsId?: string; cardId?: string; cdId?: string }>;

/** account id → persona id, from data/seed-ids.json. */
export function personaIndex(seeds: SeedAccounts): Map<string, string> {
  const index = new Map<string, string>();
  for (const [persona, ids] of Object.entries(seeds)) {
    for (const id of [ids.checkingId, ids.savingsId, ids.cardId, ids.cdId]) if (id) index.set(id, persona);
  }
  return index;
}

const int = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export function toEventRow(e: EventItem, personas: Map<string, string>): EventRow {
  const data = (e.data ?? {}) as Record<string, unknown>;
  const tx = (data.transaction ?? {}) as Record<string, unknown>;
  const accountId = e.account_id ?? str(data.account_id);
  return {
    seq: e.seq,
    createdAt: e.created_at,
    type: e.type,
    accountId,
    txId: e.tx_id ?? null,
    personaId: (accountId && personas.get(accountId)) || null,
    kind: str(tx.kind) ?? str(data.kind),
    status: str(tx.status),
    amountCents: int(tx.amount_cents),
    balanceCents: int(data.balance_cents),
    deltaCents: int(data.delta_cents),
    decision: str(tx.decision),
    decisionSource: str(tx.decision_source),
  };
}
