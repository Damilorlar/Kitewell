import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_NETWORK_ID,
  getActiveNetworkId,
  setActiveNetwork,
} from "./network";

afterEach(() => {
  vi.unstubAllGlobals();
  setActiveNetwork(DEFAULT_NETWORK_ID);
});

describe("network persist failure", () => {
  it("still switches in memory when localStorage.setItem throws", () => {
    const storage = {
      getItem: vi.fn(),
      setItem: vi.fn(() => {
        throw new Error("quota exceeded");
      }),
    };
    vi.stubGlobal("localStorage", storage);

    const next = setActiveNetwork("FUTURENET");

    expect(storage.setItem).toHaveBeenCalled();
    expect(next.horizonUrl).toBe("https://horizon-futurenet.stellar.org");
    expect(getActiveNetworkId()).toBe("FUTURENET");
  });
});
