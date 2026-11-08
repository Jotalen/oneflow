import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { Analysis } from "@/lib/engine/analyze";
import { buildBankView } from "@/lib/bank/view";
import {
  addBubble, applyPrefs, BUBBLES, canAddBubble, DEFAULT_PREFS, dropBubble, houseSummary, moveBubble,
  parseDashboardPrefs, recommendBubbles, removeBubble, setAutoPick, type BubbleId, type DashboardPrefs,
} from "@/lib/bank/bubbles";

const load = (id: string) => { const a = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/snapshots", `${id}.json`), "utf8")) as Analysis; return { a, v: buildBankView(a) }; };
const NO_GOAL = { hasGoal: false };
const ALL_IDS = Array.from({ length: 20 }, (_, i) => `C${String(i + 1).padStart(3, "0")}`);

describe("recommendBubbles: rules", () => {
  test("always includes day-to-day, safety net, recent transactions and the next best move; never accounts or house", () => {
    const { a, v } = load("C003");
    const r = recommendBubbles(a, v, NO_GOAL);
    expect(r).toEqual(expect.arrayContaining(["day_to_day", "safety_net", "recent_txns", "next_move"]));
    expect(r).not.toContain("accounts");
    expect(r).not.toContain("house");
  });
  test("the next best move sits at the bottom by default", () => {
    for (const id of ALL_IDS) {
      const { a, v } = load(id);
      const r = recommendBubbles(a, v, NO_GOAL);
      expect(r[r.length - 1], id).toBe("next_move");
    }
  });
  test("car financing appears when a Toyota contract exists; lease ending soon suggests car shopping", () => {
    const { a, v } = load("C003"); // lease, 3 months left
    const r = recommendBubbles(a, v, NO_GOAL);
    expect(r).toContain("car_financing");
    expect(r).toContain("car_shopping");
  });
  test("savings goal bubble only when a goal exists, and then it ranks above the car and balances", () => {
    const { a, v } = load("C001");
    expect(recommendBubbles(a, v, NO_GOAL)).not.toContain("savings_goal");
    const r = recommendBubbles(a, v, { hasGoal: true });
    expect(r).toContain("savings_goal");
    expect(r.indexOf("savings_goal")).toBeLessThan(r.indexOf("net_worth"));
  });
  test("safety net jumps to the front when under one month", () => {
    const { a, v } = load("C014");
    const low = { ...v, safetyNet: { ...v.safetyNet, months: 0.4 } };
    expect(recommendBubbles(a, low, NO_GOAL)[0]).toBe("safety_net");
  });
  test("a thin runway (under 3 months) puts the safety net in the top two", () => {
    const { a, v } = load("C018");
    const thin = { ...v, safetyNet: { ...v.safetyNet, months: 2.1 } };
    expect(recommendBubbles(a, thin, NO_GOAL).indexOf("safety_net")).toBeLessThanOrEqual(1);
  });
  test("lease ending soon puts the car first", () => {
    for (const id of ["C003", "C006", "C013", "C017"]) {
      const { a, v } = load(id);
      const r = recommendBubbles(a, v, NO_GOAL);
      expect(r.slice(0, 2), id).toEqual(["car_financing", "car_shopping"]);
    }
  });
  test("no car on file suggests the car-shopping bubble and drops car financing", () => {
    const { a } = load("C018");
    const noCar: Analysis = { ...a, profile: { ...a.profile, car: undefined, contract: undefined } };
    const r = recommendBubbles(noCar, buildBankView(noCar), NO_GOAL);
    expect(r).toContain("car_shopping");
    expect(r).not.toContain("car_financing");
  });
  test("heavy card use puts debt and credit ahead of the car and balances", () => {
    const { a, v } = load("C018"); // 75% card use, top move pays the card
    const r = recommendBubbles(a, v, NO_GOAL);
    expect(r.slice(0, 2)).toEqual(["debt", "credit"]);
    expect(r.indexOf("credit")).toBeLessThan(r.indexOf("car_financing"));
  });
  test("over-budget customers see Budget left near the top", () => {
    const { a, v } = load("C004");
    const r = recommendBubbles(a, v, NO_GOAL);
    expect(r).toContain("budget_left");
    expect(r.indexOf("budget_left")).toBeLessThan(r.indexOf("day_to_day"));
  });
  test("customers flagged for extra care are not shown the car-shopping pitch unless their lease is ending", () => {
    const { a, v } = load("C005"); // loan 90% paid, not vulnerable: suggested
    expect(recommendBubbles(a, v, NO_GOAL)).toContain("car_shopping");
    const careful: Analysis = { ...a, profile: { ...a.profile, flags: { ...a.profile.flags, vulnerable: true } } };
    expect(recommendBubbles(careful, v, NO_GOAL)).not.toContain("car_shopping");
  });
  test("every recommended id is a known bubble and appears once", () => {
    const known = new Set(BUBBLES.map((b) => b.id));
    for (const id of ALL_IDS) {
      const { a, v } = load(id);
      const r = recommendBubbles(a, v, NO_GOAL);
      expect(new Set(r).size, id).toBe(r.length);
      r.forEach((x) => expect(known.has(x), `${id}:${x}`).toBe(true));
    }
  });
});

describe("recommendBubbles: personalised defaults per customer", () => {
  const rec = (id: string) => { const { a, v } = load(id); return recommendBubbles(a, v, NO_GOAL); };
  test("C003 (lease ends in 3 months, 79% card use): car first, then debt and credit", () => {
    expect(rec("C003").slice(0, 4)).toEqual(["car_financing", "car_shopping", "debt", "credit"]);
  });
  test("C018 (75% card use, top move pays the card): debt and credit first, car further down", () => {
    const r = rec("C018");
    expect(r.slice(0, 2)).toEqual(["debt", "credit"]);
    expect(r).not.toContain("car_shopping");
  });
  test("C014 (extra care, missed payments, score under 600): safety net then credit then debt; no rewards", () => {
    const r = rec("C014");
    expect(r.slice(0, 3)).toEqual(["safety_net", "credit", "debt"]);
    expect(r).not.toContain("rewards");
  });
  test("C003, C018 and C014 get meaningfully different defaults", () => {
    const [x, y, z] = ["C003", "C018", "C014"].map((id) => rec(id).slice(0, 3).join(","));
    expect(new Set([x, y, z]).size).toBe(3);
  });
  test("the 20 customers do not all share one default", () => {
    const distinct = new Set(ALL_IDS.map((id) => rec(id).join(",")));
    expect(distinct.size).toBeGreaterThanOrEqual(6);
  });
});

describe("applyPrefs", () => {
  const rec: BubbleId[] = ["day_to_day", "debt", "safety_net", "recent_txns", "next_move"];
  test("auto mode: recommended minus removed, plus added at the end", () => {
    expect(applyPrefs(rec, { ...DEFAULT_PREFS, removed: ["debt"], added: ["rewards"] })).toEqual(["day_to_day", "safety_net", "recent_txns", "next_move", "rewards"]);
  });
  test("a saved order wins, new recommendations append, removed stay removed", () => {
    expect(applyPrefs([...rec, "credit"], { auto: true, order: ["recent_txns", "day_to_day", "safety_net", "next_move"], removed: ["debt"], added: [] })).toEqual(["recent_txns", "day_to_day", "safety_net", "next_move", "credit"]);
  });
  test("manual mode ignores new recommendations", () => {
    expect(applyPrefs([...rec, "credit"], { auto: false, order: ["recent_txns", "day_to_day", "next_move"], removed: [], added: [] })).toEqual(["recent_txns", "day_to_day", "next_move"]);
  });
  test("the next best move can never be removed, even by an old saved order", () => {
    expect(applyPrefs(rec, { auto: false, order: ["recent_txns"], removed: ["next_move"], added: [] })).toEqual(["recent_txns", "next_move"]);
  });
});

describe("dashboard edits flow through to what the Overview renders", () => {
  const { a, v } = load("C018");
  const recommended = recommendBubbles(a, v, NO_GOAL);
  const render = (p: DashboardPrefs) => applyPrefs(recommended, p);

  test("removing a bubble hides it", () => {
    const p = removeBubble(DEFAULT_PREFS, render(DEFAULT_PREFS), "net_worth");
    expect(render(p)).not.toContain("net_worth");
  });
  test("adding House financing and Savings goal shows them, for any customer", () => {
    let p = addBubble(DEFAULT_PREFS, render(DEFAULT_PREFS), recommended, "house");
    p = addBubble(p, render(p), recommended, "savings_goal");
    expect(render(p).slice(-2)).toEqual(["house", "savings_goal"]);
  });
  test("moving a large bubble to the top keeps it at the top (order across sizes is kept)", () => {
    let p: DashboardPrefs = DEFAULT_PREFS;
    for (let i = 0; i < recommended.length; i++) p = moveBubble(p, render(p), "recent_txns", -1);
    expect(render(p)[0]).toBe("recent_txns");
  });
  test("moving the next best move up from the bottom", () => {
    const p = moveBubble(DEFAULT_PREFS, render(DEFAULT_PREFS), "next_move", -1);
    const out = render(p);
    expect(out.indexOf("next_move")).toBe(out.length - 2);
  });
  test("moving past either end is a no-op", () => {
    const cur = render(DEFAULT_PREFS);
    expect(moveBubble(DEFAULT_PREFS, cur, cur[0], -1)).toBe(DEFAULT_PREFS);
  });
  test("drag and drop puts the dragged bubble where the target was", () => {
    const cur = render(DEFAULT_PREFS);
    const p = dropBubble(DEFAULT_PREFS, cur, "recent_txns", cur[0]);
    expect(render(p).slice(0, 2)).toEqual(["recent_txns", cur[0]]);
  });
  test("re-adding a removed recommended bubble brings it back", () => {
    const p1 = removeBubble(DEFAULT_PREFS, render(DEFAULT_PREFS), "debt");
    const p2 = addBubble(p1, render(p1), recommended, "debt");
    expect(render(p2)).toContain("debt");
    expect(p2.removed).not.toContain("debt");
  });
  test("turning auto-pick off freezes the current order", () => {
    const p = setAutoPick(DEFAULT_PREFS, render(DEFAULT_PREFS), false);
    expect(applyPrefs([...recommended, "budget_left"], p)).toEqual(render(DEFAULT_PREFS));
  });
  test("edits never mutate the previous prefs", () => {
    const before = JSON.stringify(DEFAULT_PREFS);
    removeBubble(DEFAULT_PREFS, render(DEFAULT_PREFS), "debt");
    addBubble(DEFAULT_PREFS, render(DEFAULT_PREFS), recommended, "house");
    expect(JSON.stringify(DEFAULT_PREFS)).toBe(before);
  });
  test("edits survive a save and reload (JSON round trip)", () => {
    const p = moveBubble(removeBubble(DEFAULT_PREFS, render(DEFAULT_PREFS), "rewards"), render(DEFAULT_PREFS), "car_financing", -1);
    expect(render(parseDashboardPrefs(JSON.stringify(p)))).toEqual(render(p));
  });
});

describe("canAddBubble", () => {
  test("house and savings goal are addable for every customer", () => {
    expect(canAddBubble("house", { hasContract: false })).toBe(true);
    expect(canAddBubble("savings_goal", { hasContract: false })).toBe(true);
  });
  test("car financing needs a car loan or lease", () => {
    expect(canAddBubble("car_financing", { hasContract: false })).toBe(false);
    expect(canAddBubble("car_financing", { hasContract: true })).toBe(true);
  });
});

describe("parseDashboardPrefs", () => {
  test("missing or corrupt storage gives the defaults", () => {
    expect(parseDashboardPrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parseDashboardPrefs("{not json")).toEqual(DEFAULT_PREFS);
    expect(parseDashboardPrefs("42")).toEqual(DEFAULT_PREFS);
  });
  test("unknown bubble ids from an older version are dropped", () => {
    const p = parseDashboardPrefs(JSON.stringify({ auto: false, order: ["debt", "gone_bubble"], removed: ["nope"], added: ["house"] }));
    expect(p).toEqual({ auto: false, order: ["debt"], removed: [], added: ["house"] });
  });
});

describe("bubble descriptions", () => {
  test("every bubble has a plain description, not a developer rule", () => {
    for (const b of BUBBLES) {
      expect(b.description.length, b.id).toBeGreaterThan(10);
      expect(b.description, b.id).not.toMatch(/added when|never on its own|always/i);
    }
  });
});

describe("bubble links", () => {
  test("Rewards opens the credit card details on /debt; no bubble links to the retired /rewards page", () => {
    expect(BUBBLES.find((b) => b.id === "rewards")?.href).toBe("/debt");
    expect(BUBBLES.some((b) => b.href.startsWith("/rewards"))).toBe(false);
  });
});

describe("houseSummary", () => {
  test("monthly limit is 28% of income and the price estimate fits under it", () => {
    const s = houseSummary(600_000);
    expect(s.limit).toBe(168_000);
    expect(s.price).toBeGreaterThan(0);
    expect(s.monthlyAtPrice).toBeLessThanOrEqual(s.limit);
  });
  test("no income on file means no estimate", () => {
    expect(houseSummary(0).price).toBe(0);
  });
});

