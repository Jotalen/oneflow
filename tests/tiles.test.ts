import { describe, expect, test } from "vitest";
import registry from "../data/tiles.json";
import { orderTiles, type TileDef } from "@/lib/tiles/order";
import { profileFor, typicalBundle } from "./fixtures/profiles";

const reg = registry as TileDef[];

describe("orderTiles", () => {
  test("persona without a car hides the car tile", () => {
    const p = { ...profileFor("C003"), car: undefined, contract: undefined };
    expect(orderTiles(p, reg)).not.toContain("car");
  });

  test("C003 (lease ends in 3 months) puts the car tile first", () => {
    expect(orderTiles(profileFor("C003"), reg)[0]).toBe("car");
  });

  test("C014 puts the human tile first and still shows the car tile", () => {
    const order = orderTiles(profileFor("C014"), reg);
    expect(order[0]).toBe("human");
    expect(order).toContain("car");
  });

  test("C003 (not vulnerable) has no human tile", () => {
    expect(orderTiles(profileFor("C003"), reg)).not.toContain("human");
  });

  test("C009 open recall ranks the car tile above accounts", () => {
    const order = orderTiles(profileFor("C009"), reg);
    expect(order.indexOf("car")).toBeLessThan(order.indexOf("accounts"));
  });

  test("no card account hides the cards tile; no CD hides the cd tile", () => {
    const b = typicalBundle();
    b.accounts = b.accounts.filter((a) => a.type !== "Credit Card");
    const order = orderTiles(profileFor("C003", b), reg);
    expect(order).not.toContain("cards");
    expect(order).not.toContain("cd");
  });

  test("moves and health tiles always present", () => {
    const order = orderTiles(profileFor("C003"), reg);
    expect(order).toContain("moves");
    expect(order).toContain("health");
  });
});
