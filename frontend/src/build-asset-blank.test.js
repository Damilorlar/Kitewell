import { describe, expect, it } from "vitest";
import { buildAsset } from "./stellar";

const ISSUER = "GBQNCSSNKIXG77WHAYYPYV4JG7CB4SNLMZ26WV63MNJPNN3IP72LTZTA";

describe("buildAsset whitespace code", () => {
  it("rejects a whitespace-only code as missing", () => {
    expect(() =>
      buildAsset({ isNative: false, code: "   ", issuer: ISSUER })
    ).toThrow("Asset code is required for a credit asset.");
  });
});
