import { describe, expect, it } from "vitest";
import { normalizeNetworkId } from "./networkBadgeLabel";

describe("normalizeNetworkId", () => {
  it("lowercases and trims a valid string id", () => {
    expect(normalizeNetworkId("  Testnet  ")).toBe("testnet");
  });

  it("returns an empty string for non-string input", () => {
    expect(normalizeNetworkId(null)).toBe("");
    expect(normalizeNetworkId(undefined)).toBe("");
    expect(normalizeNetworkId(7)).toBe("");
    expect(normalizeNetworkId({})).toBe("");
  });
});
