import { describe, expect, it } from "vitest";
import { resolveNetworkBadge } from "./networkBadgeLabel";

describe("resolveNetworkBadge - futurenet", () => {
  it("maps 'futurenet' to the Futurenet/purple badge", () => {
    expect(resolveNetworkBadge("futurenet")).toEqual({
      label: "Futurenet",
      color: "purple",
    });
  });
});
