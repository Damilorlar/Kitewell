import { describe, expect, it } from "vitest";
import { formatTrustlineLimit, DEFAULT_TRUSTLINE_LIMIT, MAX_TRUSTLINE_LIMIT } from "./trustlineLimitFormat";

describe("formatTrustlineLimit - default limit", () => {
  it("returns default limit when input is undefined", () => {
    const result = formatTrustlineLimit(undefined);
    expect(result).toEqual({
      formatted: DEFAULT_TRUSTLINE_LIMIT,
      type: "default",
      isZero: false,
      isDefault: true,
    });
  });

  it("returns default limit when input is null", () => {
    const result = formatTrustlineLimit(null);
    expect(result).toEqual({
      formatted: DEFAULT_TRUSTLINE_LIMIT,
      type: "default",
      isZero: false,
      isDefault: true,
    });
  });

  it("returns default limit when input is empty string", () => {
    const result = formatTrustlineLimit("");
    expect(result).toEqual({
      formatted: DEFAULT_TRUSTLINE_LIMIT,
      type: "default",
      isZero: false,
      isDefault: true,
    });
  });

  it("returns default limit when input is whitespace only", () => {
    const result = formatTrustlineLimit("   ");
    expect(result).toEqual({
      formatted: DEFAULT_TRUSTLINE_LIMIT,
      type: "default",
      isZero: false,
      isDefault: true,
    });
  });

  it("returns max limit when input is 'max' (lowercase)", () => {
    const result = formatTrustlineLimit("max");
    expect(result).toEqual({
      formatted: MAX_TRUSTLINE_LIMIT,
      type: "default",
      isZero: false,
      isDefault: true,
    });
  });

  it("returns max limit when input is 'MAX' (uppercase)", () => {
    const result = formatTrustlineLimit("MAX");
    expect(result).toEqual({
      formatted: MAX_TRUSTLINE_LIMIT,
      type: "default",
      isZero: false,
      isDefault: true,
    });
  });

  it("returns max limit when input is 'Max' (mixed case)", () => {
    const result = formatTrustlineLimit("Max");
    expect(result).toEqual({
      formatted: MAX_TRUSTLINE_LIMIT,
      type: "default",
      isZero: false,
      isDefault: true,
    });
  });

  it("returns max limit when input has whitespace around 'max'", () => {
    const result = formatTrustlineLimit("  max  ");
    expect(result).toEqual({
      formatted: MAX_TRUSTLINE_LIMIT,
      type: "default",
      isZero: false,
      isDefault: true,
    });
  });
});