import { describe, expect, it } from "vitest";
import { MAX_ASSET_CODE_LENGTH, buildAsset } from "./stellar";

const ISSUER = "GBQNCSSNKIXG77WHAYYPYV4JG7CB4SNLMZ26WV63MNJPNN3IP72LTZTA";

describe("buildAsset 12-character code", () => {
  it("keeps MAX_ASSET_CODE_LENGTH at 12", () => {
    expect(MAX_ASSET_CODE_LENGTH).toBe(12);
  });

  it("accepts a code of exactly 12 characters", () => {
    const code = "ABCDEFGHIJKL";
    const asset = buildAsset({ isNative: false, code, issuer: ISSUER });
    expect(asset.getCode()).toBe(code);
    expect(asset.getIssuer()).toBe(ISSUER);
  });
});
