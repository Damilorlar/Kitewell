import { describe, expect, it } from "vitest";
import { buildAsset } from "./stellar";

describe("buildAsset native short-circuit", () => {
  it("returns native XLM and ignores the credit fields", () => {
    const asset = buildAsset({ isNative: true, code: "", issuer: "not-a-key" });
    expect(asset.isNative()).toBe(true);
  });
});
