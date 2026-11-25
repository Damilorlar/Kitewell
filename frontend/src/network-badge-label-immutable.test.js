import { describe, expect, it } from "vitest";
import { resolveNetworkBadge } from "./networkBadgeLabel";

describe("resolveNetworkBadge - returned object identity", () => {
  it("returns a fresh object each call so callers can't mutate shared state", () => {
    const first = resolveNetworkBadge("testnet");
    const second = resolveNetworkBadge("testnet");

    expect(first).not.toBe(second);
    expect(first).toEqual(second);

    first.label = "Tampered";
    expect(resolveNetworkBadge("testnet").label).toBe("Testnet");
  });
});
