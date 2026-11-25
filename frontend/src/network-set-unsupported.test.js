import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_NETWORK_ID,
  getActiveNetworkId,
  setActiveNetwork,
} from "./network";

afterEach(() => {
  setActiveNetwork(DEFAULT_NETWORK_ID);
  vi.unstubAllGlobals();
});

describe("setActiveNetwork with unsupported network", () => {
  it("throws before assigning or persisting", () => {
    const storage = { getItem: vi.fn(), setItem: vi.fn() };
    vi.stubGlobal("localStorage", storage);

    expect(() => setActiveNetwork("MAINNET")).toThrow(
      "Unsupported network: MAINNET"
    );
    expect(getActiveNetworkId()).toBe("TESTNET");
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
