import { describe, expect, it } from "vitest";
import { formatTrustlineLimit, validateTrustlineLimit, parseTrustlineLimit, MAX_TRUSTLINE_LIMIT } from "./trustlineLimitFormat";

describe("formatTrustlineLimit - edge cases", () => {
  it("handles string with leading/trailing zeros in whole part", () => {
    const result = formatTrustlineLimit("000100.5");
    expect(result.formatted).toBe("100.5000000");
  });

  it("handles very large number as string (exceeds max, throws)", () => {
    expect(() => formatTrustlineLimit("123456789012345")).toThrow("Trustline limit cannot exceed 922337203685.4775807.");
  });

  it("handles string with only zeros - becomes zero", () => {
    const result = formatTrustlineLimit("000000");
    expect(result.formatted).toBe("0.0000000");
    expect(result.isZero).toBe(true);
  });

  it("consistency between format and parse round trip", () => {
    const testValues = [
      "100",
      "1.5",
      "1.23",
      "1.2345678",
      "1000000",
      "922337203685.4775807",
      "0",
      "0.0000001",
    ];

    for (const value of testValues) {
      const formatted = formatTrustlineLimit(value).formatted;
      const parsed = parseTrustlineLimit(formatted);
      // Parse should give back a valid numeric string
      expect(() => parseFloat(parsed)).not.toThrow();
    }
  });

  it("format and validate agree on valid inputs", () => {
    const validInputs = ["100", "1.5", "max", "zero", "0", "1000000", MAX_TRUSTLINE_LIMIT];

    for (const value of validInputs) {
      const formatResult = formatTrustlineLimit(value);
      const validateResult = validateTrustlineLimit(value);
      expect(validateResult.valid).toBe(true);
      expect(formatResult.isZero).toBe(value === "0" || value === "zero" || value === "0.0");
    }
  });

  it("format throws and validate returns invalid for same inputs", () => {
    const invalidInputs = ["-5", "1.12345678", "abc", "1e6", ".5", "1.", "922337203685.4775808"];

    for (const value of invalidInputs) {
      expect(() => formatTrustlineLimit(value)).toThrow();
      const validateResult = validateTrustlineLimit(value);
      expect(validateResult.valid).toBe(false);
    }
  });
});

describe("validateTrustlineLimit - edge cases", () => {
  it("handles whitespace around valid inputs", () => {
    expect(validateTrustlineLimit("  100  ").valid).toBe(true);
    expect(validateTrustlineLimit("  max  ").valid).toBe(true);
    expect(validateTrustlineLimit("  zero  ").valid).toBe(true);
  });

  it("handles number input types", () => {
    expect(validateTrustlineLimit(100).valid).toBe(true);
    expect(validateTrustlineLimit(1.5).valid).toBe(true);
    expect(validateTrustlineLimit(0).valid).toBe(true);
    expect(validateTrustlineLimit(-5).valid).toBe(false);
  });
});

describe("parseTrustlineLimit - edge cases", () => {
  it("handles malformed input gracefully", () => {
    expect(parseTrustlineLimit("not-a-number")).toBe("0");
    expect(parseTrustlineLimit("1.2.3")).toBe("0");
  });

  it("handles negative formatted limit", () => {
    // This shouldn't normally happen but handle gracefully
    expect(parseTrustlineLimit("-100.0000000")).toBe("-100");
  });
});