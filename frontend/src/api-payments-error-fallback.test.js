import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPaymentsViaApi } from "./api";

/**
 * Issue #79: lock the payments fallback error when the JSON body has no
 * error field.
 *
 * api.js parses the response body with `res.json().catch(() => ({}))`, so a
 * failed JSON parse silently becomes an empty object and the thrown message
 * must fall back to "Payments fetch failed". A failed response never
 * resolves to an empty list.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchPaymentsViaApi error fallback", () => {
  it("throws 'Payments fetch failed' when a non-ok body fails to parse", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.reject(new Error("invalid json")),
      })
    );

    await expect(fetchPaymentsViaApi("GTEST")).rejects.toThrow(
      "Payments fetch failed"
    );
  });
});
