import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchHealth } from "./api";
import { API_BASE } from "./config.js";

/**
 * Issue #67: lock the successful backend health request.
 *
 * On an ok response, fetchHealth resolves the parsed JSON body unchanged, so
 * the UI receives the backend payload verbatim. The request targets
 * `${API_BASE}/health` and neither the health path nor the error string is
 * changed here.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchHealth success", () => {
  it("returns the parsed JSON body unchanged for an ok response", async () => {
    const body = { ok: true, service: "kitewell-backend" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(body),
      })
    );

    const result = await fetchHealth();

    expect(result).toBe(body);
  });

  it("calls fetch with `${API_BASE}/health`", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, service: "kitewell-backend" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchHealth();

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/health`);
  });
});
