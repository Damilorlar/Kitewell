import { describe, expect, it } from "vitest";
import { formatTrustlineLimit, MAX_TRUSTLINE_LIMIT } from "./trustlineLimitFormat";

describe("formatTrustlineLimit - custom numeric limits", () => {
  it("formats integer string to 7 decimal places", () => {
    const result = formatTrustlineLimit("100");
    expect(result).toEqual({
      formatted: "100.0000000",
      type: "custom",
      isZero: false,
      isDefault: false,
    });
  });

  it("formats decimal string to 7 decimal places", () => {
    const result = formatTrustlineLimit("1.5");
    expect(result).toEqual({
      formatted: "1.5000000",
      type: "custom",
      isZero: false,
      isDefault: false,
    });
  });

  it("formats decimal with existing precision", () => {
    const result = formatTrustlineLimit("1.2345678");
    expect(result).toEqual({
      formatted: "1.2345678",
      type: "custom",
      isZero: false,
      isDefault: false,
    });
  });

  it("formats decimal with fewer than 7 places", () => {
    const result = formatTrustlineLimit("1.23");
    expect(result).toEqual({
      formatted: "1.2300000",
      type: "custom",
      isZero: false,
      isDefault: false,
    });
  });

  it("formats large integer (1000000 = default limit value)", () => {
    const result = formatTrustlineLimit("1000000");
    expect(result).toEqual({
      formatted: "1000000.0000000",
      type: "default",
      isZero: false,
      isDefault: true,
    });
  });

  it("recognizes default limit value as default type", () => {
    const result = formatTrustlineLimit("1000000");
    expect(result.type).toBe("default");
    expect(result.isDefault).toBe(true);
  });

  it("handles number input", () => {
    const result = formatTrustlineLimit(100);
    expect(result.formatted).toBe("100.0000000");
    expect(result.type).toBe("custom");
  });

  it("handles number input with decimals", () => {
    const result = formatTrustlineLimit(1.5);
    expect(result.formatted).toBe("1.5000000");
    expect(result.type).toBe("custom");
  });

  it("trims whitespace from numeric input", () => {
    const result = formatTrustlineLimit("  100.5  ");
    expect(result.formatted).toBe("100.5000000");
  });

  it("handles very large valid limit at max", () => {
    const result = formatTrustlineLimit(MAX_TRUSTLINE_LIMIT);
    expect(result.formatted).toBe(MAX_TRUSTLINE_LIMIT);
    expect(result.type).toBe("custom");
    expect(result.isDefault).toBe(false);
  });
});