import { describe, expect, it } from "vitest";
import { validateTrustlineLimit } from "./trustlineLimitFormat";

describe("validateTrustlineLimit", () => {
  it("returns valid for undefined", () => {
    const result = validateTrustlineLimit(undefined);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("returns valid for null", () => {
    const result = validateTrustlineLimit(null);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("returns valid for empty string", () => {
    const result = validateTrustlineLimit("");
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("returns valid for 'max'", () => {
    const result = validateTrustlineLimit("max");
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("returns valid for 'MAX'", () => {
    const result = validateTrustlineLimit("MAX");
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("returns valid for 'zero'", () => {
    const result = validateTrustlineLimit("zero");
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("returns valid for '0'", () => {
    const result = validateTrustlineLimit("0");
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("returns valid for '0.0'", () => {
    const result = validateTrustlineLimit("0.0");
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("returns valid for positive integer", () => {
    const result = validateTrustlineLimit("100");
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("returns valid for positive decimal", () => {
    const result = validateTrustlineLimit("1.5");
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("returns invalid for negative number", () => {
    const result = validateTrustlineLimit("-5");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Trustline limit cannot be negative.");
  });

  it("returns invalid for limit exceeding max", () => {
    const result = validateTrustlineLimit("922337203685.4775808");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Trustline limit cannot exceed 922337203685.4775807.");
  });

  it("returns invalid for more than 7 decimal places", () => {
    const result = validateTrustlineLimit("1.12345678");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Trustline limit supports at most 7 decimal places.");
  });

  it("returns invalid for non-numeric string", () => {
    const result = validateTrustlineLimit("abc");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Trustline limit must be a non-negative number, 'max', or 'zero'.");
  });

  it("returns invalid for scientific notation", () => {
    const result = validateTrustlineLimit("1e6");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Trustline limit must be a non-negative number, 'max', or 'zero'.");
  });

  it("returns single error for negative number (negative check returns early)", () => {
    const result = validateTrustlineLimit("-1.12345678");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors).toContain("Trustline limit cannot be negative.");
  });

  it("returns invalid for leading dot notation", () => {
    const result = validateTrustlineLimit(".5");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Trustline limit must be a non-negative number, 'max', or 'zero'.");
  });

  it("returns invalid for trailing dot notation", () => {
    const result = validateTrustlineLimit("1.");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Trustline limit must be a non-negative number, 'max', or 'zero'.");
  });
});