import { describe, expect, it } from "vitest";
import { isSequenceFresh, checkSequenceGap } from "./sequenceGapCheck";

describe("isSequenceFresh - wrapper function", () => {
  it("returns true when cache is fresh (gap=0)", () => {
    expect(isSequenceFresh("100", "100")).toBe(true);
  });

  it("returns true when cache is fresh with number inputs", () => {
    expect(isSequenceFresh(100, 100)).toBe(true);
  });

  it("returns false when cache is stale (gap=1)", () => {
    expect(isSequenceFresh("100", "101")).toBe(false);
  });

  it("returns false when cache is stale with larger gap", () => {
    expect(isSequenceFresh("100", "105")).toBe(false);
  });

  it("returns false when cache is stale with number inputs", () => {
    expect(isSequenceFresh(50, 55)).toBe(false);
  });

  it("throws on invalid cached input (delegates to checkSequenceGap)", () => {
    expect(() => isSequenceFresh("", "100")).toThrow(
      "Cached sequence is required."
    );
  });

  it("throws on invalid current input (delegates to checkSequenceGap)", () => {
    expect(() => isSequenceFresh("100", "abc")).toThrow(
      "Current sequence must be a non-negative integer."
    );
  });

  it("is consistent with checkSequenceGap result", () => {
    const testCases = [
      ["0", "0"],
      ["100", "100"],
      ["100", "101"],
      ["999999", "1000000"],
    ];

    for (const [cached, current] of testCases) {
      const gapResult = checkSequenceGap(cached, current);
      const freshResult = isSequenceFresh(cached, current);
      expect(freshResult).toBe(!gapResult.stale);
    }
  });
});