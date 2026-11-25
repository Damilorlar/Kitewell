import { describe, expect, it } from "vitest";
import { buildFriendbotUrl } from "./friendbotUrlBuilder";

const ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

describe("buildFriendbotUrl network validation", () => {
  it("rejects an unknown network id", () => {
    expect(() => buildFriendbotUrl("SANDBOX", ADDRESS)).toThrow(
      "Unknown network: SANDBOX."
    );
  });

  it("rejects a missing or blank network", () => {
    expect(() => buildFriendbotUrl("", ADDRESS)).toThrow("Network is required.");
    expect(() => buildFriendbotUrl("   ", ADDRESS)).toThrow(
      "Network is required."
    );
    expect(() => buildFriendbotUrl(undefined, ADDRESS)).toThrow(
      "Network is required."
    );
  });
});
