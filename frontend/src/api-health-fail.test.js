import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchHealth } from "./api";

/**
 * Issue #68: lock the health-check failure error.
 *
 * api.js throws "Backend health check failed" as soon as `res.ok` is false,
 * before the body is read, so a failing health check never resolves and no
 * error body is parsed. The response below therefore *resolves* with
 * `ok: false` rather than rejecting.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchHealth failure", () => {
  it("rejects with 'Backend health check failed' when res.ok is false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "down" }),
      })
    );

    await expect(fetchHealth()).rejects.toThrow("Backend health check failed");
  });

  it("does not read the error body before throwing", async () => {
    const json = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json })
    );

    await expect(fetchHealth()).rejects.toThrow("Backend health check failed");

    expect(json).not.toHaveBeenCalled();
  });
});
