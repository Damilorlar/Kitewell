import { describe, expect, it } from "vitest";
import { splitAssetKey } from "./assetKey";

describe("assetKey invalid key parsing", () => {
  it("rejects malformed or ambiguous keys", () => {
    expect(splitAssetKey("USD")).toBe(null);
    expect(splitAssetKey("USD:ISSUER:EXTRA")).toBe(null);
    expect(splitAssetKey("USD:Gbad")).toBe(null);
  });
});