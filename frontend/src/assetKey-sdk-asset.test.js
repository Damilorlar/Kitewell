import { Asset } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { buildAssetKey } from "./assetKey";

describe("assetKey SDK Asset", () => {
  it("supports Stellar SDK native assets", () => {
    expect(buildAssetKey(Asset.native())).toBe("native");
  });
});