import { describe, expect, it } from "vitest";
import { checkSequenceGap } from "./sequenceGapCheck";

describe("checkSequenceGap - empty/invalid current sequence", () => {
  it("throws when current is undefined", () => {
    expect(() => checkSequenceGap("100", undefined)).toThrow(
      "Current sequence is required."
    );
  });

  it("throws when current is null", () => {
    expect(() => checkSequenceGap("100", null)).toThrow(
      "Current sequence is required."
    );
  });

  it("throws when current is empty string", () => {
    expect(() => checkSequenceGap("100", "")).toThrow(
      "Current sequence is required."
    );
  });

  it("throws when current is whitespace only", () => {
    expect(() => checkSequenceGap("100", "   ")).toThrow(
      "Current sequence must be a non-negative integer."
    );
  });
});