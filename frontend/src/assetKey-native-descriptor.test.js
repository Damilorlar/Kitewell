import { describe, expect, it } from "vitest";
import { buildAssetKey, isNativeAssetKey } from "./assetKey";

describe("assetKey native descriptor", () => {
  it("recognizes native descriptors and only the exact native key", () => {
    expect(buildAssetKey({ isNative: true })).toBe("native");
    expect(isNativeAssetKey("native")).toBe(true);
    expect(isNativeAssetKey("NATIVE")).toBe(false);
  });
});