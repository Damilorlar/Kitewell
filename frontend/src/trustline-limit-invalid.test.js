import { describe, expect, it } from "vitest";
import { formatTrustlineLimit } from "./trustlineLimitFormat";

describe("formatTrustlineLimit - invalid inputs", () => {
  it("throws for negative number string", () => {
    expect(() => formatTrustlineLimit("-5")).toThrow("Trustline limit cannot be negative.");
  });

  it("throws for negative decimal string", () => {
    expect(() => formatTrustlineLimit("-1.5")).toThrow("Trustline limit cannot be negative.");
  });

  it("throws for negative number input", () => {
    expect(() => formatTrustlineLimit(-5)).toThrow("Trustline limit cannot be negative.");
  });

  it("throws for limit exceeding max", () => {
    expect(() => formatTrustlineLimit("922337203685.4775808")).toThrow("Trustline limit cannot exceed 922337203685.4775807.");
  });

  it("throws for limit far exceeding max", () => {
    expect(() => formatTrustlineLimit("999999999999999999999")).toThrow("Trustline limit cannot exceed 922337203685.4775807.");
  });

  it("throws for more than 7 decimal places", () => {
    expect(() => formatTrustlineLimit("1.12345678")).toThrow("Trustline limit supports at most 7 decimal places.");
  });

  it("throws for many decimal places", () => {
    expect(() => formatTrustlineLimit("1.123456789012345")).toThrow("Trustline limit supports at most 7 decimal places.");
  });

  it("throws for non-numeric string", () => {
    expect(() => formatTrustlineLimit("abc")).toThrow("Trustline limit must be a non-negative number, 'max', or 'zero'.");
  });

  it("throws for empty string with non-numeric chars", () => {
    expect(() => formatTrustlineLimit("1,000")).toThrow("Trustline limit must be a non-negative number, 'max', or 'zero'.");
  });

  it("throws for scientific notation", () => {
    expect(() => formatTrustlineLimit("1e6")).toThrow("Trustline limit must be a non-negative number, 'max', or 'zero'.");
  });

  it("throws for leading dot notation", () => {
    expect(() => formatTrustlineLimit(".5")).toThrow("Trustline limit must be a non-negative number, 'max', or 'zero'.");
  });

  it("throws for trailing dot notation", () => {
    expect(() => formatTrustlineLimit("1.")).toThrow("Trustline limit must be a non-negative number, 'max', or 'zero'.");
  });

  it("throws for invalid keyword", () => {
    expect(() => formatTrustlineLimit("minimum")).toThrow("Trustline limit must be a non-negative number, 'max', or 'zero'.");
  });
});