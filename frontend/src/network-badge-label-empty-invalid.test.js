import { describe, expect, it } from "vitest";
import { resolveNetworkBadge } from "./networkBadgeLabel";

describe("resolveNetworkBadge - empty/invalid input", () => {
  it("falls back to Unknown/gray for null, undefined, empty string, and non-string input", () => {
    expect(resolveNetworkBadge(null)).toEqual({
      label: "Unknown",
      color: "gray",
    });
    expect(resolveNetworkBadge(undefined)).toEqual({
      label: "Unknown",
      color: "gray",
    });
    expect(resolveNetworkBadge("")).toEqual({ label: "Unknown", color: "gray" });
    expect(resolveNetworkBadge(42)).toEqual({ label: "Unknown", color: "gray" });
  });
});
