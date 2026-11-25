import { afterEach, describe, expect, it, vi } from "vitest";
import { fundWithFriendbot } from "./stellar";

/**
 * The already-funded message is matched on the response body, not the status
 * code, so a non-400 body containing "already" still maps to the friendly
 * "refresh balances" error.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fundWithFriendbot already-funded body", () => {
  it("maps an already-funded body on a non-400 status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("account already funded"),
      })
    );

    await expect(fundWithFriendbot("GTEST")).rejects.toThrow(
      "Account may already be funded. Refresh balances instead."
    );
  });
});
