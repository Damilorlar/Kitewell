import { describe, expect, it } from "vitest";
import { formatTrustlineLimit, DEFAULT_TRUSTLINE_LIMIT, MAX_TRUSTLINE_LIMIT } from "./trustlineLimitFormat";

describe("formatTrustlineLimit - type detection", () => {
  it("detects default type for undefined", () => {
    const result = formatTrustlineLimit(undefined);
    expect(result.type).toBe("default");
    expect(result.isDefault).toBe(true);
  });

  it("detects default type for empty string", () => {
    const result = formatTrustlineLimit("");
    expect(result.type).toBe("default");
    expect(result.isDefault).toBe(true);
  });

  it("detects default type for 'max'", () => {
    const result = formatTrustlineLimit("max");
    expect(result.type).toBe("default");
    expect(result.isDefault).toBe(true);
  });

  it("detects default type for MAX_TRUSTLINE_LIMIT value when using 'max'", () => {
    const result = formatTrustlineLimit("max");
    expect(result.type).toBe("default");
    expect(result.isDefault).toBe(true);
    expect(result.formatted).toBe(MAX_TRUSTLINE_LIMIT);
  });

  it("detects default type for DEFAULT_TRUSTLINE_LIMIT value", () => {
    const result = formatTrustlineLimit(DEFAULT_TRUSTLINE_LIMIT);
    expect(result.type).toBe("default");
    expect(result.isDefault).toBe(true);
  });

  it("detects default type for numeric default limit value", () => {
    const result = formatTrustlineLimit("1000000");
    expect(result.type).toBe("default");
    expect(result.isDefault).toBe(true);
  });

  it("detects zero type for '0'", () => {
    const result = formatTrustlineLimit("0");
    expect(result.type).toBe("zero");
    expect(result.isZero).toBe(true);
    expect(result.isDefault).toBe(false);
  });

  it("detects zero type for 'zero'", () => {
    const result = formatTrustlineLimit("zero");
    expect(result.type).toBe("zero");
    expect(result.isZero).toBe(true);
    expect(result.isDefault).toBe(false);
  });

  it("detects custom type for positive custom value", () => {
    const result = formatTrustlineLimit("100");
    expect(result.type).toBe("custom");
    expect(result.isZero).toBe(false);
    expect(result.isDefault).toBe(false);
  });

  it("detects custom type for MAX_TRUSTLINE_LIMIT value (it's max, not default)", () => {
    const result = formatTrustlineLimit(MAX_TRUSTLINE_LIMIT);
    expect(result.type).toBe("custom");
    expect(result.isZero).toBe(false);
    expect(result.isDefault).toBe(false);
  });

  it("detects custom type for value just below max", () => {
    const result = formatTrustlineLimit("922337203685.4775806");
    expect(result.type).toBe("custom");
    expect(result.isZero).toBe(false);
    expect(result.isDefault).toBe(false);
  });
});