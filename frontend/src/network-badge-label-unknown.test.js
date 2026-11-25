import { describe, expect, it } from "vitest";
import { resolveNetworkBadge } from "./networkBadgeLabel";

describe("resolveNetworkBadge - unknown id", () => {
  it("falls back to Unknown/gray for an unrecognized network id", () => {
    expect(resolveNetworkBadge("mainnet")).toEqual({
      label: "Unknown",
      color: "gray",
    });
    expect(resolveNetworkBadge("not-a-network")).toEqual({
      label: "Unknown",
      color: "gray",
    });
  });
});
