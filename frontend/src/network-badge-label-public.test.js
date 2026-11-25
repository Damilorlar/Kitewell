import { describe, expect, it } from "vitest";
import { resolveNetworkBadge } from "./networkBadgeLabel";

describe("resolveNetworkBadge - public", () => {
  it("maps 'public' to the Public/green badge", () => {
    expect(resolveNetworkBadge("public")).toEqual({
      label: "Public",
      color: "green",
    });
  });
});
