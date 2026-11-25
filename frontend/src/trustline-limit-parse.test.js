import { describe, expect, it } from "vitest";
import { parseTrustlineLimit } from "./trustlineLimitFormat";

describe("parseTrustlineLimit", () => {
  it("parses default limit to human readable", () => {
    expect(parseTrustlineLimit("1000000.0000000")).toBe("1000000");
  });

  it("parses max limit to human readable", () => {
    expect(parseTrustlineLimit("922337203685.4775807")).toBe("922337203685.4775807");
  });

  it("parses zero limit to human readable", () => {
    expect(parseTrustlineLimit("0.0000000")).toBe("0");
  });

  it("parses decimal with trailing zeros", () => {
    expect(parseTrustlineLimit("1.5000000")).toBe("1.5");
  });

  it("parses decimal with multiple trailing zeros", () => {
    expect(parseTrustlineLimit("1.2300000")).toBe("1.23");
  });

  it("parses decimal with no trailing zeros", () => {
    expect(parseTrustlineLimit("1.1234567")).toBe("1.1234567");
  });

  it("parses integer with no decimal part", () => {
    expect(parseTrustlineLimit("100.0000000")).toBe("100");
  });

  it("parses large integer", () => {
    expect(parseTrustlineLimit("1000000000.0000000")).toBe("1000000000");
  });

  it("handles undefined input", () => {
    expect(parseTrustlineLimit(undefined)).toBe("0");
  });

  it("handles null input", () => {
    expect(parseTrustlineLimit(null)).toBe("0");
  });

  it("handles empty string input", () => {
    expect(parseTrustlineLimit("")).toBe("0");
  });

  it("handles whitespace input", () => {
    expect(parseTrustlineLimit("   ")).toBe("0");
  });

  it("parses small decimal values", () => {
    expect(parseTrustlineLimit("0.0000001")).toBe("0.0000001");
  });

  it("parses value with fraction only", () => {
    expect(parseTrustlineLimit("0.5000000")).toBe("0.5");
  });
});