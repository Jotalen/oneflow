import { describe, expect, test } from "vitest";
import { fmtAxisK } from "@/lib/money";

describe("fmtAxisK", () => {
  test("keeps one decimal so ticks half a thousand apart never repeat", () => {
    // Arrange: the y-axis ticks Recharts picked on the C018 net-worth chart
    const ticks = [2_200_000, 2_275_000, 2_350_000, 2_425_000, 2_500_000];

    // Act
    const labels = ticks.map(fmtAxisK);

    // Assert
    expect(new Set(labels).size).toBe(ticks.length);
    expect(labels).toEqual(["$22k", "$22.8k", "$23.5k", "$24.3k", "$25k"]);
  });

  test("drops a trailing .0 and handles zero and small values", () => {
    expect(fmtAxisK(0)).toBe("$0k");
    expect(fmtAxisK(50_000)).toBe("$0.5k");
    expect(fmtAxisK(1_800_000)).toBe("$18k");
  });
});
