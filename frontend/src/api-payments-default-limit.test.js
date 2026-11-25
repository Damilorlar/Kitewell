import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPaymentsViaApi } from "./api";
import { API_BASE } from "./config";

/**
 * Issue #76: lock the default payments query limit.
 *
 * Calling fetchPaymentsViaApi without a limit must request
 * `${API_BASE}/api/payments/<publicKey>?limit=15`.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchPaymentsViaApi default limit", () => {
  it("requests limit=15 when no limit is supplied", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ records: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchPaymentsViaApi("GTEST");

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/api/payments/GTEST?limit=15`
    );
  });
});
