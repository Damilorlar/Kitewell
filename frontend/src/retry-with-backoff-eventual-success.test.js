import { describe, expect, it, vi } from "vitest";
import { retryWithBackoff } from "./retryWithBackoff";

describe("retryWithBackoff - eventual success", () => {
  it("retries after failures and resolves once fn succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce("ok");
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      retryWithBackoff(fn, { maxAttempts: 3, sleep })
    ).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });
});
