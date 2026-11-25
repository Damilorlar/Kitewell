import { describe, expect, it, vi } from "vitest";
import { retryWithBackoff } from "./retryWithBackoff";

describe("retryWithBackoff - happy path", () => {
  it("resolves with the first attempt's result and never sleeps", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(retryWithBackoff(fn, { sleep })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
