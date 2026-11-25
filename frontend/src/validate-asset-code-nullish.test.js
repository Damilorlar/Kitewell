import { describe, expect, it } from "vitest";
import { validateAssetCode } from "./validateAssetCode";

describe("validateAssetCode nullish input", () => {
  it("throws the required-field error for null and undefined", () => {
    expect(() => validateAssetCode(null)).toThrow("Asset code is required.");
    expect(() => validateAssetCode(undefined)).toThrow("Asset code is required.");
  });
});
