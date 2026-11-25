import { afterEach, describe, expect, it } from "vitest";
import { setActiveNetwork } from "./network";
import { explorerAccountUrl, explorerTxUrl } from "./stellar";

afterEach(() => {
  setActiveNetwork("TESTNET");
});

describe("explorer urls on Futurenet", () => {
  it("follows the active network base", () => {
    setActiveNetwork("FUTURENET");

    expect(explorerAccountUrl("GTEST")).toBe(
      "https://stellar.expert/explorer/futurenet/account/GTEST"
    );
    expect(explorerTxUrl("abc")).toBe(
      "https://stellar.expert/explorer/futurenet/tx/abc"
    );
  });
});
