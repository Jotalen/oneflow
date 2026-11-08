import { describe, expect, test } from "vitest";
import { detectAnomalies, GEO_WINDOW_MIN, LARGE_NEW_PAYEE_CENTS, VELOCITY_COUNT, VELOCITY_WINDOW_MIN, type AnomalyTxn } from "@/lib/engine/anomaly";

const t0 = Date.parse("2026-11-01T12:00:00Z");
const at = (min: number) => new Date(t0 + min * 60_000).toISOString();
const purchase = (id: string, min: number, amount = 2_000, merchant = "m1", account = "acc1"): AnomalyTxn => ({ id, accountId: account, kind: "purchase", status: "completed", amountCents: amount, merchantId: merchant, createdAt: at(min) });
const transfer = (id: string, min: number, amount: number, payee: string, account = "acc1"): AnomalyTxn => ({ id, accountId: account, kind: "transfer", status: "completed", amountCents: amount, payeeId: payee, createdAt: at(min) });

describe("detectAnomalies", () => {
  test(`${VELOCITY_COUNT + 1} purchases inside ${VELOCITY_WINDOW_MIN} minutes flags velocity_spike`, () => {
    const txns = Array.from({ length: VELOCITY_COUNT + 1 }, (_, i) => purchase(`p${i}`, i));
    const hits = detectAnomalies(txns, {});
    expect(hits.some((h) => h.rule === "velocity_spike" && h.accountId === "acc1")).toBe(true);
  });

  test("purchases spread over hours do not flag velocity", () => {
    const txns = Array.from({ length: VELOCITY_COUNT + 1 }, (_, i) => purchase(`p${i}`, i * 60));
    expect(detectAnomalies(txns, {}).filter((h) => h.rule === "velocity_spike")).toHaveLength(0);
  });

  test("transfer at/above the threshold to a never-seen payee flags large_transfer_new_payee", () => {
    const txns = [transfer("t1", 0, 5_000, "friend"), transfer("t2", 60, LARGE_NEW_PAYEE_CENTS, "stranger")];
    const hits = detectAnomalies(txns, {});
    expect(hits.filter((h) => h.rule === "large_transfer_new_payee").map((h) => h.txIds)).toEqual([["t2"]]);
  });

  test("large transfer to a known payee is not flagged", () => {
    const txns = [transfer("t1", 0, 5_000, "friend"), transfer("t2", 60, LARGE_NEW_PAYEE_CENTS * 2, "friend")];
    expect(detectAnomalies(txns, {}).filter((h) => h.rule === "large_transfer_new_payee")).toHaveLength(0);
  });

  test(`purchases in two states within ${GEO_WINDOW_MIN} minutes flag geo_distant`, () => {
    const txns = [purchase("a", 0, 2_000, "tx"), purchase("b", 20, 2_000, "ny")];
    const hits = detectAnomalies(txns, { tx: "TX", ny: "NY" });
    expect(hits.some((h) => h.rule === "geo_distant" && h.txIds.includes("a") && h.txIds.includes("b"))).toBe(true);
  });

  test("same-state purchases never flag geo_distant", () => {
    const txns = [purchase("a", 0, 2_000, "tx1"), purchase("b", 5, 2_000, "tx2")];
    expect(detectAnomalies(txns, { tx1: "TX", tx2: "TX" }).filter((h) => h.rule === "geo_distant")).toHaveLength(0);
  });

  test("clean history returns no anomalies", () => {
    const txns = [purchase("a", 0), purchase("b", 400), transfer("t", 800, 1_000, "friend")];
    expect(detectAnomalies(txns, {})).toEqual([]);
  });

  test("declined attempts are ignored by velocity but counted in evidence", () => {
    const txns = Array.from({ length: VELOCITY_COUNT + 1 }, (_, i) => ({ ...purchase(`p${i}`, i), status: "declined" }));
    expect(detectAnomalies(txns, {}).filter((h) => h.rule === "velocity_spike")).toHaveLength(0);
  });
});
