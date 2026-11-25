import { describe, expect, it } from "vitest";
import { shortenAddress } from "./addressFormat";

describe("shortenAddress numeric input", () => {
  it("stringifies numbers before applying the default 6 + 6 split", () => {
    expect(shortenAddress(12345678901234)).toBe("123456…901234");
  });
});
