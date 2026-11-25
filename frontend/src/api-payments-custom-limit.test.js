import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPaymentsViaApi } from "./api";
import { API_BASE } from "./config";

/**
 * Issue #77: lock the caller-supplied payments limit.
 *
 * A `limit` argument must be interpolated into the query string so callers
 * can request fewer or more payment rows.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchPaymentsViaApi custom limit", () => {
  it("requests the caller-supplied limit in the query string", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ records: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchPaymentsViaApi("GTEST", 7);

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/api/payments/GTEST?limit=7`
    );
  });
});
