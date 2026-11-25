/**
 * Build options for the `cors` middleware from a comma-separated allowlist.
 * Empty entries are ignored; configured origins must be HTTP(S) origins.
 * The empty allowlist denies cross-origin requests by default.
 *
 * @param {Record<string, string|undefined>} [env] Environment source; defaults
 *   to `process.env`. Reads `CORS_ALLOWLIST`.
 * @returns {{ origin: string[] }} Options for `cors(options)`.
 * @throws {TypeError} If `CORS_ALLOWLIST` is not a string.
 * @throws {Error} If an entry is not an HTTP(S) origin.
 */
export function buildCorsOptions(env = process.env) {
  const configured = env?.CORS_ALLOWLIST;
  if (configured === undefined) return { origin: [] };
  if (typeof configured !== "string") {
    throw new TypeError("CORS_ALLOWLIST must be a comma-separated string");
  }

  const origins = new Set();
  for (const [index, value] of configured.split(",").entries()) {
    const entry = value.trim();
    if (!entry) continue;

    let url;
    try {
      url = new URL(entry);
    } catch {
      throw new Error(`Invalid CORS_ALLOWLIST origin at position ${index + 1}`);
    }

    if (
      !/^https?:\/\/[^\s\\/?#]+\/?$/i.test(entry) ||
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.hostname.includes("*")
    ) {
      throw new Error(`Invalid CORS_ALLOWLIST origin at position ${index + 1}`);
    }

    origins.add(url.origin);
  }

  return { origin: [...origins] };
}
