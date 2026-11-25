import { describe, expect, it } from "vitest";
import { shortenAddress } from "./addressShorten";

describe("shortenAddress non-string input", () => {
  it("rejects null, undefined, and non-string values", () => {
    expect(() => shortenAddress(null)).toThrow("Address must be a string.");
    expect(() => shortenAddress(undefined)).toThrow(
      "Address must be a string."
    );
    expect(() => shortenAddress(42)).toThrow("Address must be a string.");
    expect(() => shortenAddress(["GABC"])).toThrow("Address must be a string.");
  });
});
