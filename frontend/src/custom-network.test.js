import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CUSTOM_NETWORK_STORAGE_KEY,
  getActiveNetwork,
  getAvailableNetworks,
  removeCustomNetwork,
  saveCustomNetwork,
  setActiveNetwork,
} from "./network";

afterEach(() => {
  removeCustomNetwork();
  setActiveNetwork("TESTNET");
  vi.unstubAllGlobals();
});

describe("custom network", () => {
  it("saves and resolves its Horizon, RPC, and passphrase", () => {
    const storage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    vi.stubGlobal("localStorage", storage);

    saveCustomNetwork({
      name: "Local validator",
      horizonUrl: "https://horizon.example/",
      rpcUrl: "https://rpc.example/",
      passphrase: "Example Network ; 2026",
    });
    setActiveNetwork("CUSTOM");

    expect(getActiveNetwork()).toMatchObject({
      label: "Local validator",
      horizonUrl: "https://horizon.example",
      rpcUrl: "https://rpc.example",
      passphrase: "Example Network ; 2026",
    });
    expect(getAvailableNetworks().map(({ id }) => id)).toContain("CUSTOM");
    expect(storage.setItem).toHaveBeenCalledWith(
      CUSTOM_NETWORK_STORAGE_KEY,
      expect.any(String)
    );
  });

  it("refuses insecure URLs and blank passphrases", () => {
    expect(() => saveCustomNetwork({
      name: "Unsafe",
      horizonUrl: "http://horizon.example",
      rpcUrl: "https://rpc.example",
      passphrase: "passphrase",
    })).toThrow(/HTTPS/);

    expect(() => saveCustomNetwork({
      name: "Blank",
      horizonUrl: "https://horizon.example",
      rpcUrl: "https://rpc.example",
      passphrase: " ",
    })).toThrow(/passphrase/i);
  });

  it("returns to Testnet when the custom network is removed", () => {
    saveCustomNetwork({
      name: "Temporary",
      horizonUrl: "https://horizon.example",
      rpcUrl: "https://rpc.example",
      passphrase: "Temporary Network",
    });
    setActiveNetwork("CUSTOM");

    expect(removeCustomNetwork().id).toBe("TESTNET");
    expect(getActiveNetwork().id).toBe("TESTNET");
  });
});
