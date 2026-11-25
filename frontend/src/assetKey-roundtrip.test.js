import { describe, expect, it } from "vitest";
import { buildAssetKey, splitAssetKey } from "./assetKey";

describe("assetKey round trip", () => {
  it("preserves issued asset code casing when parsed", () => {
    const asset = { isNative: false, code: "Usdc", issuer: `G${"A".repeat(55)}` };
    expect(splitAssetKey(buildAssetKey(asset))).toEqual(asset);
  });
});