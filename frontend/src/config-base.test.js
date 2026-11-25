import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Issue #80: lock API_BASE normalization in config.js.
 *
 * config.js strips one trailing slash from VITE_API_BASE and falls back to
 * http://localhost:8787 when the variable is unset/empty. Because the value
 * is computed once at module scope, the module must be re-evaluated with
 * fresh env values: stub the env, reset the module registry, then import
 * "./config.js" dynamically. The module is never imported statically.
 */

describe("API_BASE normalization", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("strips one trailing slash from VITE_API_BASE", async () => {
    vi.stubEnv("VITE_API_BASE", "http://127.0.0.1:9999/");

    const { API_BASE } = await import("./config.js");

    expect(API_BASE).toBe("http://127.0.0.1:9999");
  });

  it("defaults to http://localhost:8787 when VITE_API_BASE is empty", async () => {
    vi.stubEnv("VITE_API_BASE", "");

    const { API_BASE } = await import("./config.js");

    expect(API_BASE).toBe("http://localhost:8787");
  });
});
