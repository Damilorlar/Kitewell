import { describe, expect, it } from "vitest";
import { shortenAddress } from "./addressShorten";

describe("shortenAddress length boundary", () => {
  it("returns a value that exactly fits unchanged and shortens one longer", () => {
    expect(shortenAddress("GABCDEFGHIJK")).toBe("GABCDEFGHIJK");
    expect(shortenAddress("GABCDEFGHIJKL")).toBe("GABCDE…GHIJKL");
  });

  it("returns exactly-fitting values unchanged for custom lengths", () => {
    expect(shortenAddress("GABCDEFGHIJK", { prefixLength: 4, suffixLength: 8 }))
      .toBe("GABCDEFGHIJK");
  });
});
