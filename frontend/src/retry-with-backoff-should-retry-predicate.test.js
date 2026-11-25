import { describe, expect, it, vi } from "vitest";
import { retryWithBackoff } from "./retryWithBackoff";

describe("retryWithBackoff - shouldRetry predicate", () => {
  it("stops immediately, without sleeping, when shouldRetry returns false", async () => {
    class NotFoundError extends Error {}
    const failure = new NotFoundError("404");
    const fn = vi.fn().mockRejectedValue(failure);
    const sleep = vi.fn().mockResolvedValue(undefined);
    const shouldRetry = vi.fn((error) => !(error instanceof NotFoundError));

    await expect(
      retryWithBackoff(fn, { maxAttempts: 5, sleep, shouldRetry })
    ).rejects.toBe(failure);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
