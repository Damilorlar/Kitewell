import { describe, expect, it } from "vitest";
import { shortenAddress } from "./addressShorten";

const G_KEY = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

describe("shortenAddress defaults", () => {
  it("shortens a G key to 6 characters plus 6 characters", () => {
    expect(shortenAddress(G_KEY)).toBe("GAAAAA…AAAWHF");
  });
});
