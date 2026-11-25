import { describe, expect, it } from "vitest";
import { buildFriendbotUrl, isFriendbotSupported } from "./friendbotUrlBuilder";

const ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

describe("buildFriendbotUrl on the public network", () => {
  it("rejects the public network because it has no Friendbot", () => {
    expect(() => buildFriendbotUrl("PUBLIC", ADDRESS)).toThrow(
      "Friendbot is not available on Public."
    );
    expect(() => buildFriendbotUrl("MAINNET", ADDRESS)).toThrow(
      "Friendbot is not available on Public."
    );
    expect(isFriendbotSupported("PUBLIC")).toBe(false);
  });
});
