import { describe, expect, it } from "vitest";
import { checkSequenceGap } from "./sequenceGapCheck";

describe("checkSequenceGap - happy path: cache is stale", () => {
  it("returns stale=true with gap=1 when current is one ahead", () => {
    const result = checkSequenceGap("100", "101");
    expect(result).toEqual({
      stale: true,
      cached: "100",
      current: "101",
      gap: 1,
    });
  });

  it("returns stale=true with gap=3 when current is three ahead", () => {
    const result = checkSequenceGap("100", "103");
    expect(result).toEqual({
      stale: true,
      cached: "100",
      current: "103",
      gap: 3,
    });
  });

  it("returns stale=true with large gap", () => {
    const result = checkSequenceGap("1000", "2000");
    expect(result).toEqual({
      stale: true,
      cached: "1000",
      current: "2000",
      gap: 1000,
    });
  });

  it("handles number inputs for stale case", () => {
    const result = checkSequenceGap(50, 55);
    expect(result).toEqual({
      stale: true,
      cached: "50",
      current: "55",
      gap: 5,
    });
  });

  it("handles whitespace around inputs in stale case", () => {
    const result = checkSequenceGap("  100  ", "  105  ");
    expect(result).toEqual({
      stale: true,
      cached: "100",
      current: "105",
      gap: 5,
    });
  });
});