import { describe, expect, it } from "vitest";
import { checkSequenceGap, isSequenceFresh } from "./sequenceGapCheck";

describe("checkSequenceGap - zero edge cases", () => {
  it("handles zero as cached with zero current (fresh)", () => {
    const result = checkSequenceGap("0", "0");
    expect(result).toEqual({
      stale: false,
      cached: "0",
      current: "0",
      gap: 0,
    });
  });

  it("handles zero as cached with non-zero current (stale)", () => {
    const result = checkSequenceGap("0", "5");
    expect(result).toEqual({
      stale: true,
      cached: "0",
      current: "5",
      gap: 5,
    });
  });

  it("handles non-zero cached with zero current (edge case - not stale)", () => {
    const result = checkSequenceGap("5", "0");
    expect(result).toEqual({
      stale: false,
      cached: "5",
      current: "0",
      gap: 0,
    });
  });

  it("isSequenceFresh returns true for zero-zero", () => {
    expect(isSequenceFresh("0", "0")).toBe(true);
  });

  it("isSequenceFresh returns false for zero-nonzero", () => {
    expect(isSequenceFresh("0", "1")).toBe(false);
  });

  it("handles string '0' and number 0 equivalently", () => {
    const result1 = checkSequenceGap("0", "0");
    const result2 = checkSequenceGap(0, 0);
    const result3 = checkSequenceGap("0", 0);
    const result4 = checkSequenceGap(0, "0");

    expect(result1).toEqual(result2);
    expect(result1).toEqual(result3);
    expect(result1).toEqual(result4);
  });
});