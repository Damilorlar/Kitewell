import { describe, expect, it } from "vitest";
import { resolveNetworkBadge } from "./networkBadgeLabel";

describe("resolveNetworkBadge - testnet", () => {
  it("maps 'testnet' to the Testnet/yellow badge", () => {
    expect(resolveNetworkBadge("testnet")).toEqual({
      label: "Testnet",
      color: "yellow",
    });
  });
});
