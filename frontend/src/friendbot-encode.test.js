import { describe, expect, it, vi } from "vitest";
import { fundWithFriendbot } from "./stellar";

describe("fundWithFriendbot address encoding", () => {
  it("encodes the address query parameter", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => ({ funded: true }) })
    );

    await expect(fundWithFriendbot("G TEST")).resolves.toEqual({ funded: true });
    expect(fetch).toHaveBeenCalledWith(
      "https://friendbot.stellar.org?addr=G%20TEST"
    );
  });
});
