import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchNetworkInfo } from "./api";
import { API_BASE } from "./config.js";

/**
 * Issue #69: lock the successful backend network request.
 *
 * On an ok response, fetchNetworkInfo resolves the parsed JSON body unchanged,
 * so the UI reads the backend payload verbatim. The request targets
 * `${API_BASE}/api/network`; the path is not changed here. The payload below
 * mirrors the shape returned by the backend's `/api/network` route.
 */

const NETWORK_BODY = {
  network: "TESTNET",
  horizonUrl: "https://horizon-testnet.stellar.org",
  friendbotUrl: "https://friendbot.stellar.org",
  explorerBase: "https://stellar.expert/explorer/testnet",
  sorobanRpcUrl: "https://soroban-testnet.stellar.org",
  passphrase: "Test SDF Network ; September 2015",
  contract: { kitewell: "CABC...", status: "configured" },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchNetworkInfo success", () => {
  it("returns the parsed JSON body unchanged for an ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(NETWORK_BODY),
      })
    );

    const result = await fetchNetworkInfo();

    expect(result).toBe(NETWORK_BODY);
  });

  it("calls fetch with `${API_BASE}/api/network`", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(NETWORK_BODY),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchNetworkInfo();

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/network`);
  });
});
