import { describe, expect, test } from "vitest";
import { MAX_P2P_CENTS, P2PRequest, p2pDescription, recipientsFor } from "@/lib/bank/p2p";

const ok = { persona: "C018", to: "C005", amountCents: 100, memo: "Lunch" };

describe("P2PRequest schema", () => {
  test("accepts a well-formed send", () => {
    expect(P2PRequest.safeParse(ok).success).toBe(true);
  });

  test("rejects sending to yourself", () => {
    const r = P2PRequest.safeParse({ ...ok, to: "C018" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toMatch(/yourself/i);
  });

  test("rejects zero, negative, fractional and absurd amounts", () => {
    for (const amountCents of [0, -100, 1.5, MAX_P2P_CENTS + 1, Number.MAX_SAFE_INTEGER]) {
      expect(P2PRequest.safeParse({ ...ok, amountCents }).success).toBe(false);
    }
    expect(P2PRequest.safeParse({ ...ok, amountCents: MAX_P2P_CENTS }).success).toBe(true);
  });

  test("memo is optional, trimmed, length-capped and free of control characters", () => {
    expect(P2PRequest.safeParse({ ...ok, memo: undefined }).success).toBe(true);
    expect(P2PRequest.parse({ ...ok, memo: "  Pizza  " }).memo).toBe("Pizza");
    expect(P2PRequest.safeParse({ ...ok, memo: "x".repeat(61) }).success).toBe(false);
    expect(P2PRequest.safeParse({ ...ok, memo: "evil\u0000memo" }).success).toBe(false);
  });

  test("rejects missing or oversized persona ids", () => {
    expect(P2PRequest.safeParse({ ...ok, persona: "" }).success).toBe(false);
    expect(P2PRequest.safeParse({ ...ok, to: "C".repeat(11) }).success).toBe(false);
  });
});

describe("p2pDescription", () => {
  test("names both people and the memo, so both ledgers read correctly", () => {
    expect(p2pDescription("Brian", "Linda", "Lunch")).toBe("P2P Brian → Linda: Lunch");
    expect(p2pDescription("Brian", "Linda")).toBe("P2P Brian → Linda");
    expect(p2pDescription("Brian", "Linda", "")).toBe("P2P Brian → Linda");
  });

  test("never exceeds Nessie's 200-char description limit", () => {
    expect(p2pDescription("B".repeat(150), "L".repeat(150), "m".repeat(60)).length).toBeLessThanOrEqual(200);
  });
});

describe("recipientsFor", () => {
  test("lists everyone except the sender, sorted by name", () => {
    const people = [{ id: "C018", name: "Brian" }, { id: "C005", name: "Linda" }, { id: "C001", name: "Maya" }, { id: "C002", name: "Carlos" }];
    expect(recipientsFor(people, "C018").map((p) => p.id)).toEqual(["C002", "C005", "C001"]);
  });
});
