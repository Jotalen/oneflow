import { describe, expect, it } from "vitest";
import {
  NAV, MOBILE_TABS, SETTINGS_ITEM, MORE_ITEM, SIDEBAR_INIT_SCRIPT, SIDEBAR_KEY,
  isNavActive, parseCollapsed,
} from "@/lib/nav";
import { hasNavIcon } from "@/components/nova/icons";

const allHrefs = () => NAV.flatMap((g) => g.items.map((it) => it.href));

describe("nav model", () => {
  it("lists the sidebar destinations in wireframe order, without Rewards", () => {
    expect(NAV.flatMap((g) => g.items.map((it) => it.label))).toEqual([
      "Overview", "Day-to-day", "Accounts", "Solana", "Transactions", "Budget",
      "Net worth", "Savings goals", "Safety net", "What if",
      "Debt & liquidity", "Credit score", "Car financing", "House financing",
    ]);
    expect(allHrefs()).not.toContain("/rewards");
  });

  it("has no duplicate hrefs", () => {
    const hrefs = [...allHrefs(), SETTINGS_ITEM.href];
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("gives every sidebar item, Settings, and every mobile tab an icon", () => {
    for (const href of [...allHrefs(), SETTINGS_ITEM.href, MORE_ITEM.href, ...MOBILE_TABS.map((t) => t.href)]) {
      expect(hasNavIcon(href), href).toBe(true);
    }
    expect(hasNavIcon("/nope")).toBe(false);
  });

  it("keeps the mobile bar to four destinations plus More", () => {
    expect(MOBILE_TABS).toHaveLength(5);
    expect(MOBILE_TABS.at(-1)).toEqual(MORE_ITEM);
    for (const t of MOBILE_TABS.slice(0, -1)) expect(allHrefs()).toContain(t.href);
  });
});

describe("isNavActive", () => {
  it("treats Overview as active on / and the dashboard editor only", () => {
    expect(isNavActive("/", "/")).toBe(true);
    expect(isNavActive("/dashboard/edit", "/")).toBe(true);
    expect(isNavActive("/budget", "/")).toBe(false);
  });

  it("matches a section and its sub-pages but not a longer sibling path", () => {
    expect(isNavActive("/goals", "/goals")).toBe(true);
    expect(isNavActive("/goals/new", "/goals")).toBe(true);
    expect(isNavActive("/carousel", "/car")).toBe(false);
    expect(isNavActive("/more", "/more")).toBe(true);
  });
});

describe("sidebar collapse store", () => {
  it("parses only a stored true as collapsed", () => {
    expect(parseCollapsed("true")).toBe(true);
    expect(parseCollapsed("false")).toBe(false);
    expect(parseCollapsed(null)).toBe(false);
    expect(parseCollapsed("{bad")).toBe(false);
  });

  const runInit = (stored: string | null, throws = false) => {
    const dataset: Record<string, string> = {};
    const storage = { getItem: (k: string) => { if (throws) throw new Error("SecurityError"); return k === SIDEBAR_KEY ? stored : null; } };
    new Function("localStorage", "document", SIDEBAR_INIT_SCRIPT)(storage, { documentElement: { dataset } });
    return dataset;
  };

  it("marks the page collapsed before first paint when the saved choice is collapsed", () => {
    expect(runInit("true").sidebar).toBe("collapsed");
  });

  it("leaves the page expanded when nothing is saved or storage is blocked", () => {
    expect(runInit(null).sidebar).toBeUndefined();
    expect(runInit("false").sidebar).toBeUndefined();
    expect(() => runInit("true", true)).not.toThrow();
  });
});
