import { describe, expect, it } from "vitest";
import { formatTrustlineLimit, validateTrustlineLimit, parseTrustlineLimit } from "./trustlineLimitFormat";

describe("formatTrustlineLimit - whitespace and case handling", () => {
  it("trims leading/trailing whitespace", () => {
    expect(formatTrustlineLimit("  100  ").formatted).toBe("100.0000000");
    expect(formatTrustlineLimit("  max  ").formatted).toBe("922337203685.4775807");
    expect(formatTrustlineLimit("  zero  ").formatted).toBe("0.0000000");
  });

  it("handles tabs and newlines", () => {
    expect(formatTrustlineLimit("\t100\n").formatted).toBe("100.0000000");
    expect(formatTrustlineLimit("\tmax\n").formatted).toBe("922337203685.4775807");
    expect(formatTrustlineLimit("\tzero\n").formatted).toBe("0.0000000");
  });

  it("handles case-insensitive 'max'", () => {
    expect(formatTrustlineLimit("MAX").formatted).toBe("922337203685.4775807");
    expect(formatTrustlineLimit("Max").formatted).toBe("922337203685.4775807");
    expect(formatTrustlineLimit("mAx").formatted).toBe("922337203685.4775807");
  });

  it("handles case-insensitive 'zero'", () => {
    expect(formatTrustlineLimit("ZERO").formatted).toBe("0.0000000");
    expect(formatTrustlineLimit("Zero").formatted).toBe("0.0000000");
    expect(formatTrustlineLimit("zErO").formatted).toBe("0.0000000");
  });
});

describe("validateTrustlineLimit - whitespace and case handling", () => {
  it("trims whitespace before validation", () => {
    expect(validateTrustlineLimit("  100  ").valid).toBe(true);
    expect(validateTrustlineLimit("  max  ").valid).toBe(true);
    expect(validateTrustlineLimit("  zero  ").valid).toBe(true);
  });

  it("handles case-insensitive keywords", () => {
    expect(validateTrustlineLimit("MAX").valid).toBe(true);
    expect(validateTrustlineLimit("ZERO").valid).toBe(true);
  });
});

describe("parseTrustlineLimit - whitespace handling", () => {
  it("trims whitespace", () => {
    expect(parseTrustlineLimit("  100.0000000  ")).toBe("100");
    expect(parseTrustlineLimit("\t0.0000000\n")).toBe("0");
  });
});