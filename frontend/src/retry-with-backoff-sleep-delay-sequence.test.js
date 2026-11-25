import { describe, expect, it, vi } from "vitest";
import { retryWithBackoff } from "./retryWithBackoff";

describe("retryWithBackoff - sleep delay sequence", () => {
  it("calls sleep with the exponentially growing delay before each retry", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("1"))
      .mockRejectedValueOnce(new Error("2"))
      .mockRejectedValueOnce(new Error("3"))
      .mockResolvedValueOnce("ok");
    const delays = [];
    const sleep = vi.fn((ms) => {
      delays.push(ms);
      return Promise.resolve();
    });

    await retryWithBackoff(fn, {
      maxAttempts: 4,
      baseDelayMs: 50,
      factor: 2,
      sleep,
    });

    expect(delays).toEqual([50, 100, 200]);
  });
});
