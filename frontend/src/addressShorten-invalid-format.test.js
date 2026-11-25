import { describe, expect, it } from "vitest";
import { shortenAddress } from "./addressShorten";

describe("shortenAddress malformed addresses", () => {
  it("rejects values that are not canonical G... public keys", () => {
    const message = "Invalid Stellar address. Expected a G... public key.";

    expect(() =>
      shortenAddress("gaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaawhf")
    ).toThrow(message);
    expect(() =>
      shortenAddress("SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF")
    ).toThrow(message);
    expect(() =>
      shortenAddress("G0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHF")
    ).toThrow(message);
    expect(() => shortenAddress("G")).toThrow(message);
  });
});
