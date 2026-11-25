import { describe, expect, it } from "vitest";
import { buildFriendbotUrl } from "./friendbotUrlBuilder";

describe("buildFriendbotUrl address validation", () => {
  it("rejects an empty, blank, or non-string address", () => {
    expect(() => buildFriendbotUrl("TESTNET", "")).toThrow(
      "A Stellar address is required."
    );
    expect(() => buildFriendbotUrl("TESTNET", "   ")).toThrow(
      "A Stellar address is required."
    );
    expect(() => buildFriendbotUrl("TESTNET", null)).toThrow(
      "A Stellar address is required."
    );
    expect(() => buildFriendbotUrl("TESTNET", undefined)).toThrow(
      "A Stellar address is required."
    );
  });
});
