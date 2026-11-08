import { describe, expect, test } from "vitest";
import { formatCountUp, parseCountUp } from "@/lib/countup";

const SAMPLES = ["$23,724", "721 · Good", "$28,617.46", "9.1 months", "−$12.00", "+$1,204.50", "up to $2,000/mo", "1,234,567 pts", "18%", "3 linked"];

describe("parseCountUp", () => {
  test("splits the first number from its prefix and suffix", () => {
    // Arrange
    const text = "721 · Good";

    // Act
    const parts = parseCountUp(text);

    // Assert
    expect(parts).toEqual({ prefix: "", token: "721", value: 721, decimals: 0, grouped: false, suffix: " · Good" });
  });

  test("keeps the sign and currency symbol in the prefix", () => {
    const parts = parseCountUp("−$12.00");
    expect(parts).toMatchObject({ prefix: "−$", token: "12.00", value: 12, decimals: 2, suffix: "" });
  });

  test("reads thousands separators and decimal places", () => {
    expect(parseCountUp("$28,617.46")).toMatchObject({ value: 28617.46, decimals: 2, grouped: true });
    expect(parseCountUp("9.1 months")).toMatchObject({ value: 9.1, decimals: 1, grouped: false, suffix: " months" });
  });

  test("only animates the first number", () => {
    expect(parseCountUp("$1,000 own − $200 owe")).toMatchObject({ prefix: "$", token: "1,000", suffix: " own − $200 owe" });
  });

  test("returns null when there is nothing to count", () => {
    expect(parseCountUp("—")).toBeNull();
    expect(parseCountUp("n/a")).toBeNull();
    expect(parseCountUp("$0.00")).toBeNull();
  });

  test("returns null for a number it could not reproduce exactly", () => {
    expect(parseCountUp("007 agents")).toBeNull();
    expect(parseCountUp("12,34 odd")).toBeNull();
  });
});

describe("formatCountUp", () => {
  test("formats in-between values with the same separators and decimals", () => {
    // Arrange
    const parts = parseCountUp("$28,617.46");

    // Act
    const mid = parts && formatCountUp(parts, 1234.5);

    // Assert
    expect(mid).toBe("$1,234.50");
  });

  test("starts at zero with the original shape", () => {
    expect(formatCountUp(parseCountUp("−$12.00")!, 0)).toBe("−$0.00");
    expect(formatCountUp(parseCountUp("721 · Good")!, 0)).toBe("0 · Good");
  });

  test("clamps to the range 0..value", () => {
    const parts = parseCountUp("$23,724")!;
    expect(formatCountUp(parts, -5)).toBe("$0");
    expect(formatCountUp(parts, 99_999)).toBe("$23,724");
  });

  test.each(SAMPLES)("ends on exactly the input text: %s", (text) => {
    const parts = parseCountUp(text);
    expect(parts).not.toBeNull();
    expect(formatCountUp(parts!, parts!.value)).toBe(text);
  });
});
