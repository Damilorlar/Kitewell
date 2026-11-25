import { describe, expect, it } from "vitest";
import { buildFriendbotUrl } from "./friendbotUrlBuilder";

const ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

describe("buildFriendbotUrl with a network descriptor", () => {
  it("trims a trailing slash from a custom Friendbot base URL", () => {
    expect(
      buildFriendbotUrl(
        { id: "TESTNET", friendbotUrl: "https://faucet.example.org/" },
        ADDRESS
      )
    ).toBe(`https://faucet.example.org?addr=${ADDRESS}`);
  });

  it("rejects a descriptor without a Friendbot URL", () => {
    expect(() =>
      buildFriendbotUrl({ id: "FUTURENET", label: "Futurenet", friendbotUrl: null }, ADDRESS)
    ).toThrow("Friendbot is not available on Futurenet.");
  });
});
