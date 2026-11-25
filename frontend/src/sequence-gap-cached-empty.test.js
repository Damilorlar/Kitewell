import { describe, expect, it } from "vitest";
import { checkSequenceGap } from "./sequenceGapCheck";

describe("checkSequenceGap - empty/invalid cached sequence", () => {
  it("throws when cached is undefined", () => {
    expect(() => checkSequenceGap(undefined, "100")).toThrow(
      "Cached sequence is required."
    );
  });

  it("throws when cached is null", () => {
    expect(() => checkSequenceGap(null, "100")).toThrow(
      "Cached sequence is required."
    );
  });

  it("throws when cached is empty string", () => {
    expect(() => checkSequenceGap("", "100")).toThrow(
      "Cached sequence is required."
    );
  });

  it("throws when cached is whitespace only", () => {
    expect(() => checkSequenceGap("   ", "100")).toThrow(
      "Cached sequence must be a non-negative integer."
    );
  });
});