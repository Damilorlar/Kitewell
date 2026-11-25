import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAccountViaApi } from "./api";

/**
 * Issue #73: lock the account fetch fallback when the body cannot be parsed.
 *
 * api.js parses the response body with `res.json().catch(() => ({}))`, so a
 * failed JSON parse silently becomes an empty object and the thrown message
 * must fall back to "Account fetch failed". A failed response never resolves
 * as a successful account.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchAccountViaApi non-JSON fallback", () => {
  it("throws 'Account fetch failed' when a non-ok body fails to parse", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.reject(new Error("invalid json")),
      })
    );

    await expect(fetchAccountViaApi("GTEST")).rejects.toThrow(
      "Account fetch failed"
    );
  });
});
