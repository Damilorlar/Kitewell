import { describe, expect, it } from "vitest";
import { checkSequenceGap } from "./sequenceGapCheck";

describe("checkSequenceGap - whitespace and type handling", () => {
  it("trims whitespace from cached string input", () => {
    const result = checkSequenceGap("  100  ", "100");
    expect(result.cached).toBe("100");
    expect(result.stale).toBe(false);
  });

  it("trims whitespace from current string input", () => {
    const result = checkSequenceGap("100", "  100  ");
    expect(result.current).toBe("100");
    expect(result.stale).toBe(false);
  });

  it("handles tabs and newlines in cached input", () => {
    const result = checkSequenceGap("\t100\n", "100");
    expect(result.cached).toBe("100");
    expect(result.stale).toBe(false);
  });

  it("handles tabs and newlines in current input", () => {
    const result = checkSequenceGap("100", "\t100\n");
    expect(result.current).toBe("100");
    expect(result.stale).toBe(false);
  });

  it("converts number inputs to strings in result", () => {
    const result = checkSequenceGap(100, 100);
    expect(typeof result.cached).toBe("string");
    expect(typeof result.current).toBe("string");
    expect(result.cached).toBe("100");
    expect(result.current).toBe("100");
  });

  it("mixed number and string inputs work correctly", () => {
    const result = checkSequenceGap("100", 100);
    expect(result.stale).toBe(false);
    expect(result.cached).toBe("100");
    expect(result.current).toBe("100");
  });
});