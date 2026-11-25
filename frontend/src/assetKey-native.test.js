import { describe, expect, it } from "vitest";
import { buildAssetKey } from "./assetKey";

describe("assetKey native Horizon asset", () => {
  it("uses the canonical native key", () => {
    expect(buildAssetKey({ asset_type: "native" })).toBe("native");
  });
});