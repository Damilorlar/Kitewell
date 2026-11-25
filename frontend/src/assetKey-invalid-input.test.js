import { describe, expect, it } from "vitest";
import { buildAssetKey } from "./assetKey";

describe("assetKey invalid input", () => {
  it("returns null for missing or malformed asset fields", () => {
    expect(buildAssetKey(null)).toBe(null);
    expect(buildAssetKey({ isNative: false, code: "USD" })).toBe(null);
    expect(buildAssetKey({ isNative: false, code: "TOO-LONG-CODE12", issuer: `G${"A".repeat(55)}` })).toBe(null);
    expect(buildAssetKey({ asset_type: "unknown" })).toBe(null);
  });
});