import { describe, expect, it } from "vitest";
import { checkSequenceGap } from "./sequenceGapCheck";

describe("checkSequenceGap - boundary values", () => {
  it("returns gap=1 at the stale boundary (minimal staleness)", () => {
    const result = checkSequenceGap("100", "101");
    expect(result.gap).toBe(1);
    expect(result.stale).toBe(true);
  });

  it("returns gap=0 when cached equals current (fresh boundary)", () => {
    const result = checkSequenceGap("100", "100");
    expect(result.gap).toBe(0);
    expect(result.stale).toBe(false);
  });

  it("handles very large sequence numbers (near u64 max)", () => {
    // u64 max is 18446744073709551615
    const maxU64 = "18446744073709551615";
    const result = checkSequenceGap(maxU64, maxU64);
    expect(result).toEqual({
      stale: false,
      cached: maxU64,
      current: maxU64,
      gap: 0,
    });
  });

  it("handles large gap near u64 max", () => {
    const maxU64 = "18446744073709551615";
    const nearMax = "18446744073709551610";
    const result = checkSequenceGap(nearMax, maxU64);
    expect(result.stale).toBe(true);
    expect(result.gap).toBe(5);
  });

  it("handles sequence starting from 0 with gap=1", () => {
    const result = checkSequenceGap("0", "1");
    expect(result).toEqual({
      stale: true,
      cached: "0",
      current: "1",
      gap: 1,
    });
  });

  it("handles sequence starting from 0 fresh", () => {
    const result = checkSequenceGap("0", "0");
    expect(result).toEqual({
      stale: false,
      cached: "0",
      current: "0",
      gap: 0,
    });
  });
});