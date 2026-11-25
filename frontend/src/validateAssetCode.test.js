import { describe, expect, it } from "vitest";
import { validateAssetCode } from "./validateAssetCode";

describe("validateAssetCode", () => {
  it("accepts valid codes and uppercases them", () => {
    expect(validateAssetCode("USDC")).toBe("USDC");
    expect(validateAssetCode("usdc")).toBe("USDC");
    expect(validateAssetCode("  Xlm1  ")).toBe("XLM1");
  });

  it("accepts the 12-character boundary", () => {
    expect(validateAssetCode("ABCDEFGHIJKL")).toBe("ABCDEFGHIJKL");
  });

  it("rejects empty input", () => {
    expect(() => validateAssetCode("")).toThrow(/required/);
    expect(() => validateAssetCode("   ")).toThrow(/required/);
    expect(() => validateAssetCode(null)).toThrow(/required/);
    expect(() => validateAssetCode(undefined)).toThrow(/required/);
  });

  it("rejects codes longer than 12 characters", () => {
    expect(() => validateAssetCode("ABCDEFGHIJKLM")).toThrow(
      /1–12 alphanumeric/
    );
  });

  it("rejects non-alphanumeric characters", () => {
    expect(() => validateAssetCode("US DC")).toThrow(/1–12 alphanumeric/);
    expect(() => validateAssetCode("US-DC")).toThrow(/1–12 alphanumeric/);
    expect(() => validateAssetCode("US_DC")).toThrow(/1–12 alphanumeric/);
    expect(() => validateAssetCode("USDC!")).toThrow(/1–12 alphanumeric/);
    expect(() => validateAssetCode("$")).toThrow(/1–12 alphanumeric/);
  });

  it("uses the label in error messages", () => {
    expect(() => validateAssetCode("", "Send asset code")).toThrow(
      /^Send asset code is required\.$/
    );
  });
});
