import { describe, expect, it } from "vitest";
import { shortenAddress } from "./addressFormat";

const G_KEY = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

describe("shortenAddress", () => {
  it("returns falsy input untouched", () => {
    expect(shortenAddress(null)).toBeNull();
    expect(shortenAddress(undefined)).toBeUndefined();
    expect(shortenAddress("")).toBe("");
  });

  it("returns short values unchanged", () => {
    expect(shortenAddress("USDC")).toBe("USDC");
    expect(shortenAddress("GABC")).toBe("GABC");
  });

  it("truncates a normal G-key to 6 + 6", () => {
    expect(shortenAddress(G_KEY)).toBe("GAAAAA…AAAWHF");
  });

  it("truncates at the exact boundary (12 chars)", () => {
    expect(shortenAddress("123456789012")).toBe("123456…789012");
  });

  it("supports custom leading/trailing lengths", () => {
    expect(shortenAddress(G_KEY, 4, 4)).toBe("GAAA…AWHF");
    expect(shortenAddress(G_KEY, 10, 3)).toBe("GAAAAAAAAA…WHF");
  });
});
