import { describe, expect, it } from "vitest";
import { buildAssetKey } from "./assetKey";

describe("assetKey asset code boundary", () => {
  it("accepts the maximum 12-character alphanumeric code", () => {
    const issuer = `G${"A".repeat(55)}`;
    expect(buildAssetKey({ isNative: false, code: "ABCDEFGHIJKL", issuer })).toBe(
      `ABCDEFGHIJKL:${issuer}`
    );
  });
});