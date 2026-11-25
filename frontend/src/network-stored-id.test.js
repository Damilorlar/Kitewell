import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("network stored id", () => {
  it("falls back to Testnet when the stored id is not a supported network", async () => {
    const storage = { getItem: vi.fn(() => "PUBLIC"), setItem: vi.fn() };
    vi.stubGlobal("localStorage", storage);
    vi.resetModules();

    const { NETWORK_STORAGE_KEY, getActiveNetwork, getActiveNetworkId } =
      await import("./network.js");

    expect(storage.getItem).toHaveBeenCalledWith(NETWORK_STORAGE_KEY);
    expect(getActiveNetworkId()).toBe("TESTNET");
    expect(getActiveNetwork().horizonUrl).toBe(
      "https://horizon-testnet.stellar.org"
    );
  });
});
