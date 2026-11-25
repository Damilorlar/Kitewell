import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchNetworkInfo } from "./api";

/**
 * Issue #70: lock the network-endpoint failure error.
 *
 * api.js throws "Backend network endpoint failed" as soon as `res.ok` is false,
 * before the body is read, so a failing network check never resolves and no
 * error body is parsed. The response below therefore *resolves* with
 * `ok: false` rather than rejecting.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchNetworkInfo failure", () => {
  it("rejects with 'Backend network endpoint failed' when res.ok is false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "down" }),
      })
    );

    await expect(fetchNetworkInfo()).rejects.toThrow(
      "Backend network endpoint failed"
    );
  });

  it("does not read the error body before throwing", async () => {
    const json = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json })
    );

    await expect(fetchNetworkInfo()).rejects.toThrow(
      "Backend network endpoint failed"
    );

    expect(json).not.toHaveBeenCalled();
  });
});
