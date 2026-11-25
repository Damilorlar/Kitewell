import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAccountViaApi } from "./api";

/**
 * Issue #72: lock the account error message taken from a JSON body.
 *
 * On a non-ok response, fetchAccountViaApi throws `data.error` when that
 * field is present in the parsed body, so backend-provided messages reach
 * the UI verbatim. The fallback string is not changed here.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchAccountViaApi error field", () => {
  it("throws the body's error field on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({ error: "Invalid Stellar public key" }),
      })
    );

    await expect(fetchAccountViaApi("GTEST")).rejects.toThrow(
      "Invalid Stellar public key"
    );
  });
});
