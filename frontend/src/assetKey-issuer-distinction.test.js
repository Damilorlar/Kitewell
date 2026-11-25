import { describe, expect, it } from "vitest";
import { buildAssetKey } from "./assetKey";

describe("assetKey issuer distinction", () => {
  it("produces different keys for the same code from different issuers", () => {
    const first = `G${"A".repeat(55)}`;
    const second = `G${"B".repeat(55)}`;
    expect(buildAssetKey({ isNative: false, code: "USD", issuer: first })).not.toBe(
      buildAssetKey({ isNative: false, code: "USD", issuer: second })
    );
  });
});