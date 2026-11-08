import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { Analysis } from "@/lib/engine/analyze";
import { buildBankView } from "@/lib/bank/view";
import { recommendBubbles, applyPrefs, DEFAULT_PREFS } from "@/lib/bank/bubbles";

const load = (id: string) => { const a = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/snapshots", `${id}.json`), "utf8")) as Analysis; return { a, v: buildBankView(a) }; };

describe("recommendBubbles", () => {
  test("always includes day-to-day, safety net and recent transactions; never accounts or house", () => {
    const { a, v } = load("C003");
    const r = recommendBubbles(a, v, { hasGoal: false });
    expect(r).toEqual(expect.arrayContaining(["day_to_day", "safety_net", "recent_txns"]));
    expect(r).not.toContain("accounts");
    expect(r).not.toContain("house");
  });
  test("car financing appears when a Toyota contract exists; lease ending soon suggests car shopping", () => {
    const { a, v } = load("C003"); // lease, 3 months left
    const r = recommendBubbles(a, v, { hasGoal: false });
    expect(r).toContain("car_financing");
    expect(r).toContain("car_shopping");
  });
  test("savings goal bubble only when a goal exists", () => {
    const { a, v } = load("C001");
    expect(recommendBubbles(a, v, { hasGoal: false })).not.toContain("savings_goal");
    expect(recommendBubbles(a, v, { hasGoal: true })).toContain("savings_goal");
  });
  test("safety net jumps to the front when under one month", () => {
    const { a, v } = load("C014");
    const low = { ...v, safetyNet: { ...v.safetyNet, months: 0.4 } };
    expect(recommendBubbles(a, low, { hasGoal: false })[0]).toBe("safety_net");
  });
});

describe("applyPrefs", () => {
  const rec = ["day_to_day", "debt", "safety_net", "recent_txns"] as const;
  test("auto mode: recommended minus removed, plus added at the end", () => {
    expect(applyPrefs([...rec], { ...DEFAULT_PREFS, removed: ["debt"], added: ["rewards"] })).toEqual(["day_to_day", "safety_net", "recent_txns", "rewards"]);
  });
  test("a saved order wins, new recommendations append, removed stay removed", () => {
    expect(applyPrefs([...rec, "credit"], { auto: true, order: ["recent_txns", "day_to_day", "safety_net"], removed: ["debt"], added: [] })).toEqual(["recent_txns", "day_to_day", "safety_net", "credit"]);
  });
  test("manual mode ignores new recommendations", () => {
    expect(applyPrefs([...rec, "credit"], { auto: false, order: ["recent_txns", "day_to_day"], removed: [], added: [] })).toEqual(["recent_txns", "day_to_day"]);
  });
});
