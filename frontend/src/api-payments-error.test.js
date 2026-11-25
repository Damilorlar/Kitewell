import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPaymentsViaApi } from "./api";

/**
 * Issue #78: lock the payments error message taken from a JSON body.
 *
 * On a non-ok response, fetchPaymentsViaApi throws `data.error` when that
 * field is present in the parsed body, so backend-provided messages reach
 * the UI verbatim. The fallback string is not changed here.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchPaymentsViaApi error field", () => {
  it("throws the body's error field on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Could not load payments" }),
      })
    );

    await expect(fetchPaymentsViaApi("GTEST")).rejects.toThrow(
      "Could not load payments"
    );
  });
});
