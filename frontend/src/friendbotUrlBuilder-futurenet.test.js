import { describe, expect, it } from "vitest";
import { buildFriendbotUrl } from "./friendbotUrlBuilder";

const ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

describe("buildFriendbotUrl on Futurenet", () => {
  it("uses the Futurenet Friendbot endpoint", () => {
    expect(buildFriendbotUrl("FUTURENET", ADDRESS)).toBe(
      `https://friendbot-futurenet.stellar.org?addr=${ADDRESS}`
    );
  });
});
