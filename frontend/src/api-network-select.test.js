import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAccountViaApi, fetchPaymentsViaApi } from "./api";
import { API_BASE } from "./config.js";

/**
 * Issue #492: the frontend asks the backend for the selected network instead
 * of skipping it off Testnet.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

function okResponse(body) {
  return { ok: true, json: () => Promise.resolve(body) };
}

describe("backend network selection", () => {
  it("adds network=FUTURENET to account reads", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ id: "GTEST" }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchAccountViaApi("GTEST", "FUTURENET");

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/api/account/GTEST?network=FUTURENET`
    );
  });

  it("adds the selected network to payment reads alongside pagination", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse({ records: [], nextCursor: null }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchPaymentsViaApi("GTEST", 5, "token-1", "FUTURENET");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain(`${API_BASE}/api/payments/GTEST?`);
    expect(url).toContain("limit=5");
    expect(url).toContain("cursor=token-1");
    expect(url).toContain("network=FUTURENET");
  });

  it("omits the network query when no network is passed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ id: "GTEST" }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchAccountViaApi("GTEST");

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/account/GTEST`);
  });
});
