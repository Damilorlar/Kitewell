import { describe, expect, it } from "vitest";
import { shortenAddress } from "./addressShorten";

const G_KEY = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

describe("shortenAddress whitespace handling", () => {
  it("trims surrounding whitespace before shortening", () => {
    expect(shortenAddress(`  ${G_KEY}\n`)).toBe("GAAAAA…AAAWHF");
  });
});
