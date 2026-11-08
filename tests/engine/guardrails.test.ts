import { describe, expect, test } from "vitest";
import { guardrails } from "@/lib/engine/guardrails";
import { profileFor } from "../fixtures/profiles";

describe("guardrails", () => {
  test("C014 → humanHandoff (vulnerable + 2 missed)", () => {
    const g = guardrails(profileFor("C014"));
    expect(g.humanHandoff).toBe(true);
    expect(g.reasons.join(" ")).toMatch(/vulnerable/i);
    expect(g.reasons.join(" ")).toMatch(/missed/i);
  });
  test("C011 → noNewVehicleOffers (consent N) and humanHandoff (vulnerable)", () => {
    const g = guardrails(profileFor("C011"));
    expect(g.noNewVehicleOffers).toBe(true);
    expect(g.humanHandoff).toBe(true);
  });
  test("C003 → neither", () => {
    expect(guardrails(profileFor("C003"))).toMatchObject({ humanHandoff: false, noNewVehicleOffers: false });
  });
  test("2 missed payments alone triggers handoff", () => {
    const p = profileFor("C003");
    expect(guardrails({ ...p, flags: { ...p.flags, missed12m: 2 } }).humanHandoff).toBe(true);
  });
});
