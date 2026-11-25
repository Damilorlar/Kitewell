import { describe, expect, it } from "vitest";
import { checkSequenceGap } from "./sequenceGapCheck";

describe("checkSequenceGap - happy path: cache is fresh", () => {
  it("returns stale=false when cached equals current (string inputs)", () => {
    const result = checkSequenceGap("100", "100");
    expect(result).toEqual({
      stale: false,
      cached: "100",
      current: "100",
      gap: 0,
    });
  });

  it("returns stale=false when cached equals current (number inputs)", () => {
    const result = checkSequenceGap(100, 100);
    expect(result).toEqual({
      stale: false,
      cached: "100",
      current: "100",
      gap: 0,
    });
  });

  it("returns stale=false with zero sequences", () => {
    const result = checkSequenceGap("0", "0");
    expect(result).toEqual({
      stale: false,
      cached: "0",
      current: "0",
      gap: 0,
    });
  });

  it("handles whitespace around inputs", () => {
    const result = checkSequenceGap("  100  ", "  100  ");
    expect(result).toEqual({
      stale: false,
      cached: "100",
      current: "100",
      gap: 0,
    });
  });
});