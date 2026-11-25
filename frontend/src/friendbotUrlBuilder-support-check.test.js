import { describe, expect, it } from "vitest";
import { buildFriendbotUrl, isFriendbotSupported } from "./friendbotUrlBuilder";

describe("isFriendbotSupported", () => {
  it("reports support only for networks with a Friendbot endpoint", () => {
    expect(isFriendbotSupported("TESTNET")).toBe(true);
    expect(isFriendbotSupported("testnet")).toBe(true);
    expect(isFriendbotSupported("FUTURENET")).toBe(true);
    expect(isFriendbotSupported("PUBLIC")).toBe(false);
    expect(isFriendbotSupported("MAINNET")).toBe(false);
    expect(isFriendbotSupported("SANDBOX")).toBe(false);
    expect(isFriendbotSupported("")).toBe(false);
    expect(isFriendbotSupported(null)).toBe(false);
    expect(isFriendbotSupported(undefined)).toBe(false);
    expect(isFriendbotSupported({ friendbotUrl: null })).toBe(false);
  });

  it("matches the network id case-insensitively when building", () => {
    const address = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
    expect(buildFriendbotUrl("testnet", address)).toBe(
      `https://friendbot.stellar.org?addr=${address}`
    );
  });
});
