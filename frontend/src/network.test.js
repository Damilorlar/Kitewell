import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_NETWORK_ID,
  NETWORKS,
  NETWORK_STORAGE_KEY,
  getActiveNetwork,
  getActiveNetworkId,
  isFriendbotAvailable,
  isSupportedNetwork,
  setActiveNetwork,
} from "./network";

afterEach(() => {
  setActiveNetwork(DEFAULT_NETWORK_ID);
  vi.unstubAllGlobals();
});

describe("network config", () => {
  it("defaults to Testnet", () => {
    expect(DEFAULT_NETWORK_ID).toBe("TESTNET");
    expect(getActiveNetworkId()).toBe("TESTNET");
    expect(getActiveNetwork().horizonUrl).toBe(
      "https://horizon-testnet.stellar.org"
    );
  });

  it("defines a Horizon URL and passphrase for every network", () => {
    for (const network of Object.values(NETWORKS)) {
      expect(typeof network.horizonUrl).toBe("string");
      expect(network.horizonUrl).toMatch(/^https:\/\//);
      expect(typeof network.passphrase).toBe("string");
      expect(network.passphrase.length).toBeGreaterThan(0);
      expect(network.explorerBase).toMatch(/stellar\.expert/);
    }
  });

  it("switches between Testnet and Futurenet", () => {
    const next = setActiveNetwork("FUTURENET");

    expect(next.horizonUrl).toBe("https://horizon-futurenet.stellar.org");
    expect(getActiveNetworkId()).toBe("FUTURENET");
    expect(getActiveNetwork().explorerBase).toBe(
      "https://stellar.expert/explorer/futurenet"
    );
    expect(getActiveNetwork().passphrase).toContain("Future");
  });

  it("rejects unsupported networks without changing state", () => {
    expect(isSupportedNetwork("PUBLIC")).toBe(false);
    expect(() => setActiveNetwork("PUBLIC")).toThrow(/Unsupported network/);
    expect(getActiveNetworkId()).toBe("TESTNET");
  });

  it("exposes Friendbot only on Testnet", () => {
    expect(isFriendbotAvailable()).toBe(true);
    setActiveNetwork("FUTURENET");
    expect(isFriendbotAvailable()).toBe(false);
  });

  it("persists the selected network to localStorage", () => {
    const storage = { getItem: vi.fn(), setItem: vi.fn() };
    vi.stubGlobal("localStorage", storage);

    setActiveNetwork("FUTURENET");

    expect(storage.setItem).toHaveBeenCalledWith(
      NETWORK_STORAGE_KEY,
      "FUTURENET"
    );
  });
});
