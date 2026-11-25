import { describe, expect, it } from "vitest";
import { shortenAddress } from "./addressShorten";

const G_KEY = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

describe("shortenAddress length validation", () => {
  it("rejects negative, fractional, and non-numeric lengths", () => {
    expect(() => shortenAddress(G_KEY, { prefixLength: -1 })).toThrow(
      "prefixLength must be a non-negative integer."
    );
    expect(() => shortenAddress(G_KEY, { suffixLength: 1.5 })).toThrow(
      "suffixLength must be a non-negative integer."
    );
    expect(() => shortenAddress(G_KEY, { suffixLength: "4" })).toThrow(
      "suffixLength must be a non-negative integer."
    );
  });
});
