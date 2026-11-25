import { describe, expect, it } from "vitest";
import { buildAssetKey } from "./assetKey";

describe("assetKey issued Horizon asset", () => {
  it("combines the code and issuer using the stable backend shape", () => {
    const issuer = `G${"A".repeat(55)}`;
    expect(
      buildAssetKey({
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
        asset_issuer: issuer,
      })
    ).toBe(`USDC:${issuer}`);
  });
});