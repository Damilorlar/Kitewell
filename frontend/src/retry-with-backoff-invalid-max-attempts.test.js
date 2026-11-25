import { describe, expect, it, vi } from "vitest";
import { retryWithBackoff } from "./retryWithBackoff";

describe("retryWithBackoff - invalid maxAttempts", () => {
  it("rejects with a RangeError for a non-positive or non-integer maxAttempts, without calling fn", async () => {
    const fn = vi.fn();

    await expect(retryWithBackoff(fn, { maxAttempts: 0 })).rejects.toThrow(
      RangeError
    );
    await expect(retryWithBackoff(fn, { maxAttempts: -1 })).rejects.toThrow(
      RangeError
    );
    await expect(retryWithBackoff(fn, { maxAttempts: 1.5 })).rejects.toThrow(
      RangeError
    );
    expect(fn).not.toHaveBeenCalled();
  });
});
