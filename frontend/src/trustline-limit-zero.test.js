import { describe, expect, it } from "vitest";
import { formatTrustlineLimit } from "./trustlineLimitFormat";

describe("formatTrustlineLimit - zero limit (remove trustline)", () => {
  it("returns zero limit when input is '0'", () => {
    const result = formatTrustlineLimit("0");
    expect(result).toEqual({
      formatted: "0.0000000",
      type: "zero",
      isZero: true,
      isDefault: false,
    });
  });

  it("returns zero limit when input is '0.0'", () => {
    const result = formatTrustlineLimit("0.0");
    expect(result).toEqual({
      formatted: "0.0000000",
      type: "zero",
      isZero: true,
      isDefault: false,
    });
  });

  it("returns zero limit when input is '0.0000000'", () => {
    const result = formatTrustlineLimit("0.0000000");
    expect(result).toEqual({
      formatted: "0.0000000",
      type: "zero",
      isZero: true,
      isDefault: false,
    });
  });

  it("returns zero limit when input is 'zero' (lowercase)", () => {
    const result = formatTrustlineLimit("zero");
    expect(result).toEqual({
      formatted: "0.0000000",
      type: "zero",
      isZero: true,
      isDefault: false,
    });
  });

  it("returns zero limit when input is 'ZERO' (uppercase)", () => {
    const result = formatTrustlineLimit("ZERO");
    expect(result).toEqual({
      formatted: "0.0000000",
      type: "zero",
      isZero: true,
      isDefault: false,
    });
  });

  it("returns zero limit when input is 'Zero' (mixed case)", () => {
    const result = formatTrustlineLimit("Zero");
    expect(result).toEqual({
      formatted: "0.0000000",
      type: "zero",
      isZero: true,
      isDefault: false,
    });
  });

  it("returns zero limit when input has whitespace around 'zero'", () => {
    const result = formatTrustlineLimit("  zero  ");
    expect(result).toEqual({
      formatted: "0.0000000",
      type: "zero",
      isZero: true,
      isDefault: false,
    });
  });

  it("returns zero limit when input is number 0", () => {
    const result = formatTrustlineLimit(0);
    expect(result).toEqual({
      formatted: "0.0000000",
      type: "zero",
      isZero: true,
      isDefault: false,
    });
  });

  it("returns zero limit when input is number 0.0", () => {
    const result = formatTrustlineLimit(0.0);
    expect(result).toEqual({
      formatted: "0.0000000",
      type: "zero",
      isZero: true,
      isDefault: false,
    });
  });
});