import { describe, expect, it } from "vitest";
import { shortenAddress } from "./addressShorten";

describe("shortenAddress zero-length sides", () => {
  it("omits a side when its length is 0", () => {
    expect(shortenAddress("GABCDEFGHIJKL", { prefixLength: 4, suffixLength: 0 }))
      .toBe("GABC…");
    expect(shortenAddress("GABCDEFGHIJKL", { prefixLength: 0, suffixLength: 4 }))
      .toBe("…IJKL");
  });

  it("rejects both sides being 0", () => {
    expect(() =>
      shortenAddress("GABCDEFGHIJKL", { prefixLength: 0, suffixLength: 0 })
    ).toThrow("prefixLength and suffixLength cannot both be 0.");
  });
});
