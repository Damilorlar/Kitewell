import { describe, expect, it } from "vitest";
import { buildFriendbotUrl } from "./friendbotUrlBuilder";

const ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

describe("buildFriendbotUrl on Testnet", () => {
  it("builds the Testnet Friendbot URL for a valid address", () => {
    expect(buildFriendbotUrl("TESTNET", ADDRESS)).toBe(
      `https://friendbot.stellar.org?addr=${ADDRESS}`
    );
  });
});
