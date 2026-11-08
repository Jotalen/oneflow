import { describe, expect, it } from "vitest";
import { INTRO_INIT_SCRIPT } from "@/lib/intro/init";

/** Runs the <head> script against a fake browser and reports whether the intro was set to play. */
function plays({ search = "", seen = false, matches = [] as string[] } = {}): boolean {
  const html = { dataset: {} as Record<string, string> };
  const env = {
    location: { search },
    sessionStorage: { getItem: () => (seen ? "1" : null) },
    matchMedia: (q: string) => ({ matches: matches.some((m) => q.includes(m)) }),
    document: { documentElement: html },
  };
  new Function(...Object.keys(env), INTRO_INIT_SCRIPT)(...Object.values(env));
  return html.dataset.intro === "play";
}

describe("intro head script", () => {
  it("plays on a desktop browser the first time", () => {
    expect(plays()).toBe(true);
  });

  it("does not replay in the same tab unless ?intro is set", () => {
    expect(plays({ seen: true })).toBe(false);
    expect(plays({ seen: true, search: "?intro" })).toBe(true);
  });

  it("never plays at phone width, even with ?intro", () => {
    expect(plays({ matches: ["max-width"] })).toBe(false);
    expect(plays({ matches: ["max-width"], search: "?intro" })).toBe(false);
  });

  it("never plays on a touch-first device such as a phone or tablet", () => {
    expect(plays({ matches: ["pointer: coarse"] })).toBe(false);
  });

  it("never plays when reduced motion is on", () => {
    expect(plays({ matches: ["reduced-motion"] })).toBe(false);
  });
});
