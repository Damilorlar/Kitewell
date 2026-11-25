import { describe, expect, it, vi } from "vitest";
import { fundWithFriendbot } from "./stellar";

describe("fundWithFriendbot generic failures", () => {
  it("uses the generic message for a non-400 response body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("nope"),
      })
    );

    await expect(fundWithFriendbot("GTEST")).rejects.toThrow(
      "Friendbot funding failed. Try again in a moment."
    );
  });

  it("uses the generic message when reading the failure body rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.reject(new Error("body unavailable")),
      })
    );

    await expect(fundWithFriendbot("GTEST")).rejects.toThrow(
      "Friendbot funding failed. Try again in a moment."
    );
  });
});
