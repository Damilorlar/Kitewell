import { describe, expect, it } from "vitest";
import { checkSequenceGap } from "./sequenceGapCheck";

describe("checkSequenceGap - error/unusual cases", () => {
  it("returns stale=false with gap=0 when cached > current (should not happen on-chain)", () => {
    // This is an edge case - cached sequence somehow higher than current
    // The function treats this as fresh (not stale) with gap=0
    const result = checkSequenceGap("105", "100");
    expect(result).toEqual({
      stale: false,
      cached: "105",
      current: "100",
      gap: 0,
    });
  });

  it("handles BigInt-compatible large numbers correctly", () => {
    // Test with numbers that require BigInt precision
    const result = checkSequenceGap("9007199254740991", "9007199254740992");
    // 9007199254740991 is Number.MAX_SAFE_INTEGER
    expect(result.stale).toBe(true);
    expect(result.gap).toBe(1);
  });

  it("throws descriptive error for negative cached (string)", () => {
    expect(() => checkSequenceGap("-1", "100")).toThrow(
      "Cached sequence must be a non-negative integer."
    );
  });

  it("throws descriptive error for negative current (string)", () => {
    expect(() => checkSequenceGap("100", "-1")).toThrow(
      "Current sequence must be a non-negative integer."
    );
  });

  it("throws when cached is a negative number", () => {
    expect(() => checkSequenceGap(-5, "100")).toThrow(
      "Cached sequence must be a non-negative integer."
    );
  });

  it("throws when current is a negative number", () => {
    expect(() => checkSequenceGap("100", -5)).toThrow(
      "Current sequence must be a non-negative integer."
    );
  });
});