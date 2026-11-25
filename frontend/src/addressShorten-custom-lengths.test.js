import { describe, expect, it } from "vitest";
import { shortenAddress } from "./addressShorten";

const G_KEY = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

describe("shortenAddress custom lengths", () => {
  it("honours prefixLength and suffixLength", () => {
    expect(shortenAddress(G_KEY, { prefixLength: 4, suffixLength: 4 })).toBe(
      "GAAA…AWHF"
    );
    expect(shortenAddress(G_KEY, { prefixLength: 10, suffixLength: 3 })).toBe(
      "GAAAAAAAAA…WHF"
    );
  });
});
