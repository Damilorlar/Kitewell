import { describe, expect, it, vi } from "vitest";
import { retryWithBackoff } from "./retryWithBackoff";

describe("retryWithBackoff - exhausted attempts", () => {
  it("rejects with the last error once maxAttempts is reached", async () => {
    const failure = new Error("still down");
    const fn = vi.fn().mockRejectedValue(failure);
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      retryWithBackoff(fn, { maxAttempts: 3, sleep })
    ).rejects.toBe(failure);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });
});
