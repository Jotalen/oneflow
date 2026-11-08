import { fmtUSD, type Cents } from "@/lib/money";

/** Rule detectors over unlabeled simulator data (ADR-008). Thresholds are the whole policy; keep them here. */
export const VELOCITY_WINDOW_MIN = 10;
export const VELOCITY_COUNT = 5;
export const GEO_WINDOW_MIN = 60;
export const LARGE_NEW_PAYEE_CENTS: Cents = 150_000;

export interface AnomalyTxn { id: string; accountId: string; kind: string; status: string; amountCents: Cents; merchantId?: string | null; payeeId?: string | null; createdAt?: string }
export type AnomalyRule = "velocity_spike" | "geo_distant" | "large_transfer_new_payee";
export interface Anomaly { rule: AnomalyRule; accountId: string; txIds: string[]; evidence: string; at: string }

const ms = (t: AnomalyTxn) => (t.createdAt ? Date.parse(t.createdAt) : 0);
const byTime = (a: AnomalyTxn, b: AnomalyTxn) => ms(a) - ms(b);
const settled = (t: AnomalyTxn) => t.status !== "declined" && t.status !== "cancelled";

function groupByAccount(txns: AnomalyTxn[]): Map<string, AnomalyTxn[]> {
  const m = new Map<string, AnomalyTxn[]>();
  for (const t of txns) m.set(t.accountId, [...(m.get(t.accountId) ?? []), t]);
  for (const list of m.values()) list.sort(byTime);
  return m;
}

function velocity(list: AnomalyTxn[]): Anomaly | null {
  const p = list.filter((t) => t.kind === "purchase" && settled(t));
  const win = VELOCITY_WINDOW_MIN * 60_000;
  for (let i = 0; i + VELOCITY_COUNT < p.length + 0; i++) {
    const j = i + VELOCITY_COUNT;
    if (j < p.length && ms(p[j]) - ms(p[i]) <= win) {
      const slice = p.slice(i, j + 1);
      return { rule: "velocity_spike", accountId: p[i].accountId, txIds: slice.map((t) => t.id), evidence: `${slice.length} purchases in ${Math.round((ms(p[j]) - ms(p[i])) / 60_000)} min, ${fmtUSD(slice.reduce((s, t) => s + t.amountCents, 0))} total`, at: p[i].createdAt ?? "" };
    }
  }
  return null;
}

function geoDistant(list: AnomalyTxn[], merchantState: Record<string, string>): Anomaly[] {
  const p = list.filter((t) => t.kind === "purchase" && t.merchantId && merchantState[t.merchantId]);
  const win = GEO_WINDOW_MIN * 60_000;
  const out: Anomaly[] = [];
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i];
    const sa = merchantState[a.merchantId!], sb = merchantState[b.merchantId!];
    if (sa !== sb && ms(b) - ms(a) <= win) {
      out.push({ rule: "geo_distant", accountId: b.accountId, txIds: [a.id, b.id], evidence: `${sa} then ${sb} within ${Math.round((ms(b) - ms(a)) / 60_000)} min`, at: b.createdAt ?? "" });
    }
  }
  return out;
}

function largeNewPayee(list: AnomalyTxn[]): Anomaly[] {
  const seen = new Set<string>();
  const out: Anomaly[] = [];
  for (const t of list) {
    if (t.kind !== "transfer" || !t.payeeId) continue;
    if (!seen.has(t.payeeId) && t.amountCents >= LARGE_NEW_PAYEE_CENTS && settled(t)) {
      out.push({ rule: "large_transfer_new_payee", accountId: t.accountId, txIds: [t.id], evidence: `${fmtUSD(t.amountCents)} to a first-time payee`, at: t.createdAt ?? "" });
    }
    seen.add(t.payeeId);
  }
  return out;
}

/** merchantState: merchant id → two-letter state, for the geo rule. */
export function detectAnomalies(txns: AnomalyTxn[], merchantState: Record<string, string>): Anomaly[] {
  const out: Anomaly[] = [];
  for (const list of groupByAccount(txns).values()) {
    const v = velocity(list);
    if (v) out.push(v);
    out.push(...geoDistant(list, merchantState), ...largeNewPayee(list));
  }
  return out.sort((a, b) => Date.parse(b.at || "0") - Date.parse(a.at || "0"));
}
