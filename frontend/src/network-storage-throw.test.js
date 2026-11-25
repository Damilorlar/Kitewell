import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("network storage read failure", () => {
  it("falls back to Testnet when localStorage.getItem throws", async () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error("storage unavailable");
      }),
      setItem: vi.fn(),
    };
    vi.stubGlobal("localStorage", storage);
    vi.resetModules();

    const importPromise = import("./network.js");
    await expect(importPromise).resolves.toBeDefined();
    const { getActiveNetworkId } = await importPromise;

    expect(storage.getItem).toHaveBeenCalled();
    expect(getActiveNetworkId()).toBe("TESTNET");
  });
});
