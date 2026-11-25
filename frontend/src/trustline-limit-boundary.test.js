import { describe, expect, it } from "vitest";
import { formatTrustlineLimit, MAX_TRUSTLINE_LIMIT, DEFAULT_TRUSTLINE_LIMIT } from "./trustlineLimitFormat";

describe("formatTrustlineLimit - boundary values", () => {
  it("handles minimum positive value (1 stroop)", () => {
    const result = formatTrustlineLimit("0.0000001");
    expect(result).toEqual({
      formatted: "0.0000001",
      type: "custom",
      isZero: false,
      isDefault: false,
    });
  });

  it("handles maximum valid value (INT64_MAX stroops) - this is custom, not default", () => {
    const result = formatTrustlineLimit(MAX_TRUSTLINE_LIMIT);
    expect(result).toEqual({
      formatted: MAX_TRUSTLINE_LIMIT,
      type: "custom",
      isZero: false,
      isDefault: false,
    });
  });

  it("handles default limit value (1,000,000) - this IS the default", () => {
    const result = formatTrustlineLimit(DEFAULT_TRUSTLINE_LIMIT);
    expect(result).toEqual({
      formatted: DEFAULT_TRUSTLINE_LIMIT,
      type: "default",
      isZero: false,
      isDefault: true,
    });
  });

  it("handles value just below max", () => {
    const result = formatTrustlineLimit("922337203685.4775806");
    expect(result.formatted).toBe("922337203685.4775806");
    expect(result.type).toBe("custom");
    expect(result.isDefault).toBe(false);
  });

  it("handles value at max boundary", () => {
    const result = formatTrustlineLimit("922337203685.4775807");
    expect(result.formatted).toBe("922337203685.4775807");
    expect(result.type).toBe("custom");
    expect(result.isDefault).toBe(false);
  });

  it("rejects value just above max", () => {
    expect(() => formatTrustlineLimit("922337203685.4775808")).toThrow("Trustline limit cannot exceed 922337203685.4775807.");
  });

  it("handles exactly 7 decimal places", () => {
    const result = formatTrustlineLimit("123.1234567");
    expect(result.formatted).toBe("123.1234567");
  });

  it("handles zero as boundary between zero and positive", () => {
    const result = formatTrustlineLimit("0");
    expect(result.isZero).toBe(true);
    expect(result.formatted).toBe("0.0000000");
  });

  it("handles very small positive near zero", () => {
    const result = formatTrustlineLimit("0.0000001");
    expect(result.isZero).toBe(false);
    expect(result.formatted).toBe("0.0000001");
  });
});