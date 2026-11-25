import { describe, expect, it } from "vitest";
import { buildFriendbotUrl } from "./friendbotUrlBuilder";

describe("buildFriendbotUrl address length boundary", () => {
  it("accepts exactly 56 characters and rejects one either side", () => {
    const valid = `G${"A".repeat(55)}`;
    expect(valid).toHaveLength(56);
    expect(buildFriendbotUrl("TESTNET", valid)).toBe(
      `https://friendbot.stellar.org?addr=${valid}`
    );

    expect(() => buildFriendbotUrl("TESTNET", `G${"A".repeat(54)}`)).toThrow(
      "Invalid Stellar address. Expected a G... public key."
    );
    expect(() => buildFriendbotUrl("TESTNET", `G${"A".repeat(56)}`)).toThrow(
      "Invalid Stellar address. Expected a G... public key."
    );
  });
});
