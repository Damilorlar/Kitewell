import { describe, expect, it, vi } from "vitest";
import { retryWithBackoff } from "./retryWithBackoff";

describe("retryWithBackoff - maxAttempts boundary", () => {
  it("never retries when maxAttempts is 1", async () => {
    const failure = new Error("down");
    const fn = vi.fn().mockRejectedValue(failure);
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      retryWithBackoff(fn, { maxAttempts: 1, sleep })
    ).rejects.toBe(failure);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
