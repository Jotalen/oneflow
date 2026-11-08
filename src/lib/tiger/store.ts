import type { BalanceBucket } from "./history";
import type { EventRow } from "./events";
import { tigerPool } from "./db";

const INSERT_CHUNK = 500;
const COLUMNS = ["seq", "created_at", "type", "account_id", "tx_id", "persona_id", "kind", "status", "amount_cents", "balance_cents", "delta_cents", "decision", "decision_source"] as const;

const values = (r: EventRow) => [r.seq, r.createdAt, r.type, r.accountId, r.txId, r.personaId, r.kind, r.status, r.amountCents, r.balanceCents, r.deltaCents, r.decision, r.decisionSource];

/** Insert events; re-delivered events (same seq) are ignored. Returns rows actually inserted. */
export async function insertEvents(rows: EventRow[]): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);
    const params: unknown[] = [];
    const tuples = chunk.map((r) => {
      const v = values(r);
      const start = params.length;
      params.push(...v);
      return `(${v.map((_, j) => `$${start + j + 1}`).join(",")})`;
    });
    const res = await tigerPool().query(`INSERT INTO nessie_events (${COLUMNS.join(",")}) VALUES ${tuples.join(",")} ON CONFLICT DO NOTHING`, params);
    inserted += res.rowCount ?? 0;
  }
  return inserted;
}

/** Highest event seq stored, so a backfill can resume. */
export async function maxStoredSeq(): Promise<number> {
  const res = await tigerPool().query<{ max: string | null }>("SELECT max(seq)::text AS max FROM nessie_events");
  return Number(res.rows[0]?.max ?? 0);
}

/** `holds`: transactions that entered the bank as pending (every new purchase, transfer or deposit). */
export interface ActivityStats { events: number; holds: number; declined: number; firstAt: string | null; lastAt: string | null }

export async function readBalanceBuckets(personaId: string): Promise<BalanceBucket[]> {
  const res = await tigerPool().query<{ bucket: Date; account_id: string; balance_cents: string }>(
    "SELECT bucket, account_id, balance_cents FROM account_balance_15m WHERE persona_id = $1 ORDER BY bucket",
    [personaId],
  );
  return res.rows.map((r) => ({ bucket: r.bucket.toISOString(), accountId: r.account_id, balanceCents: Number(r.balance_cents) }));
}

export async function readActivity(personaId: string): Promise<ActivityStats> {
  const res = await tigerPool().query<{ events: string; holds: string; declined: string; first_at: Date | null; last_at: Date | null }>(
    `SELECT count(*)::text AS events,
            count(*) FILTER (WHERE type = 'transaction.created' AND status = 'pending')::text AS holds,
            count(*) FILTER (WHERE type = 'transaction.declined')::text AS declined,
            min(created_at) AS first_at, max(created_at) AS last_at
       FROM nessie_events WHERE persona_id = $1`,
    [personaId],
  );
  const r = res.rows[0];
  return {
    events: Number(r?.events ?? 0), holds: Number(r?.holds ?? 0), declined: Number(r?.declined ?? 0),
    firstAt: r?.first_at?.toISOString() ?? null, lastAt: r?.last_at?.toISOString() ?? null,
  };
}
