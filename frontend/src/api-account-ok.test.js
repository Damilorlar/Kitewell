import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAccountViaApi } from "./api";
import { API_BASE } from "./config.js";

/**
 * Issue #71: lock the successful account fetch.
 *
 * On an ok response, fetchAccountViaApi resolves the parsed JSON body
 * unchanged. The request targets `${API_BASE}/api/account/${publicKey}`.
 * The payload is not remapped here.
 */

const ACCOUNT_BODY = {
  id: "GTEST",
  balances: [{ asset_type: "native", balance: "10000.0000000" }],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchAccountViaApi success", () => {
  it("returns the parsed JSON body unchanged for an ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(ACCOUNT_BODY),
      })
    );

    const result = await fetchAccountViaApi("GTEST");

    expect(result).toBe(ACCOUNT_BODY);
  });

  it("calls fetch with `${API_BASE}/api/account/GTEST`", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(ACCOUNT_BODY),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchAccountViaApi("GTEST");

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/account/GTEST`);
  });
});
