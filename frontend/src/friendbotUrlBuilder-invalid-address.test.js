import { describe, expect, it } from "vitest";
import { buildFriendbotUrl } from "./friendbotUrlBuilder";

describe("buildFriendbotUrl malformed addresses", () => {
  it("rejects addresses that are not canonical G... public keys", () => {
    const message = "Invalid Stellar address. Expected a G... public key.";

    expect(() =>
      buildFriendbotUrl(
        "TESTNET",
        "gaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaawhf"
      )
    ).toThrow(message);
    expect(() =>
      buildFriendbotUrl(
        "TESTNET",
        "SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
      )
    ).toThrow(message);
    expect(() =>
      buildFriendbotUrl(
        "TESTNET",
        "G0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHF"
      )
    ).toThrow(message);
    expect(() => buildFriendbotUrl("TESTNET", "GABC")).toThrow(message);
  });
});
