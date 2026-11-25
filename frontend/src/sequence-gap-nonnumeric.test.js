import { describe, expect, it } from "vitest";
import { checkSequenceGap } from "./sequenceGapCheck";

describe("checkSequenceGap - non-numeric inputs", () => {
  it("throws when cached is non-numeric string", () => {
    expect(() => checkSequenceGap("abc", "100")).toThrow(
      "Cached sequence must be a non-negative integer."
    );
  });

  it("throws when cached contains decimal point", () => {
    expect(() => checkSequenceGap("100.5", "100")).toThrow(
      "Cached sequence must be a non-negative integer."
    );
  });

  it("throws when cached contains negative sign", () => {
    expect(() => checkSequenceGap("-100", "100")).toThrow(
      "Cached sequence must be a non-negative integer."
    );
  });

  it("throws when cached contains exponent notation", () => {
    expect(() => checkSequenceGap("1e5", "100")).toThrow(
      "Cached sequence must be a non-negative integer."
    );
  });

  it("throws when current is non-numeric string", () => {
    expect(() => checkSequenceGap("100", "xyz")).toThrow(
      "Current sequence must be a non-negative integer."
    );
  });

  it("throws when current contains decimal point", () => {
    expect(() => checkSequenceGap("100", "100.5")).toThrow(
      "Current sequence must be a non-negative integer."
    );
  });

  it("throws when current contains negative sign", () => {
    expect(() => checkSequenceGap("100", "-50")).toThrow(
      "Current sequence must be a non-negative integer."
    );
  });

  it("throws when current contains exponent notation", () => {
    expect(() => checkSequenceGap("100", "1e5")).toThrow(
      "Current sequence must be a non-negative integer."
    );
  });
});