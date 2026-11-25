import { describe, expect, it } from "vitest";
import { getActiveNetwork, getActiveNetworkId, setActiveNetwork } from "./network";

describe("network unknown id", () => {
  it("rejects a lowercase network id without changing state", () => {
    expect(() => setActiveNetwork("testnet")).toThrow(
      "Unsupported network: testnet"
    );
    expect(getActiveNetworkId()).toBe("TESTNET");
    expect(getActiveNetwork().horizonUrl).toBe(
      "https://horizon-testnet.stellar.org"
    );
  });
});
