import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPaymentsViaApi } from "./api";

/**
 * Issue #75: lock the empty payments fallback.
 *
 * When a successful response body has no `records` key,
 * fetchPaymentsViaApi resolves with an empty page instead of throwing.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchPaymentsViaApi empty fallback", () => {
  it("resolves to an empty page when records is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })
    );

    await expect(fetchPaymentsViaApi("GTEST")).resolves.toEqual({
      records: [],
      nextCursor: null,
    });
  });
});
