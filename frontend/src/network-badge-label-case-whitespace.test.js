import { describe, expect, it } from "vitest";
import { resolveNetworkBadge } from "./networkBadgeLabel";

describe("resolveNetworkBadge - case and whitespace boundary", () => {
  it("is case-insensitive and trims surrounding whitespace", () => {
    expect(resolveNetworkBadge("TESTNET")).toEqual({
      label: "Testnet",
      color: "yellow",
    });
    expect(resolveNetworkBadge("  public  ")).toEqual({
      label: "Public",
      color: "green",
    });
    expect(resolveNetworkBadge("FutureNet")).toEqual({
      label: "Futurenet",
      color: "purple",
    });
  });
});
