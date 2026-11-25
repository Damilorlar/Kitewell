/**
 * Asset issuer display formatter.
 *
 * Renders an asset as one compact display string for asset lists, for example
 * `USDC (centre.io)` when the issuer's home domain is known, or
 * `USDC (GAAAAA…AAAWHF)` — a shortened issuer — when no domain is known.
 *
 * The module is standalone: nothing in `App.jsx`, `freighter.js`, or
 * `stellar.js` imports it yet, and wiring it into the UI is a separate issue.
 * It has no SDK dependency, so it stays a pure string helper that can be unit
 * tested in isolation.
 *
 * Input shape (all fields optional except where noted):
 *
 * ```js
 * {
 *   code: "USDC",                       // required for credit assets
 *   issuer: "G...",                     // required for credit assets
 *   domain: "centre.io",                // optional issuer home domain
 *   homeDomain: "centre.io",            // alias for `domain`
 *   isNative: false,                    // true for native XLM
 * }
 * ```
 */

/** Ellipsis inserted between the kept prefix and suffix of an issuer. */
export const ISSUER_ELLIPSIS = "…";

/** Characters kept from the start of an issuer address by default. */
export const DEFAULT_ISSUER_PREFIX_LENGTH = 6;

/** Characters kept from the end of an issuer address by default. */
export const DEFAULT_ISSUER_SUFFIX_LENGTH = 6;

/** Maximum length of a Stellar asset code. */
export const MAX_ASSET_CODE_LENGTH = 12;

/** Maximum length of a home domain, matching the DNS limit. */
export const MAX_DOMAIN_LENGTH = 253;

/** Canonical shape of a Stellar ed25519 public key: `G` plus 55 base32 chars. */
const STELLAR_PUBLIC_KEY = /^G[A-Z2-7]{55}$/;

/** A single DNS label: alphanumeric, inner hyphens only, at most 63 chars. */
const DOMAIN_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/** Asset codes are 1–12 alphanumeric characters, canonically uppercase. */
const ASSET_CODE = /^[A-Z0-9]{1,12}$/;

/**
 * Result of formatting an asset for display.
 * @typedef {Object} AssetIssuerDisplayInput
 * @property {string} [code] - Asset code (1–12 alphanumeric characters).
 * @property {string} [issuer] - Issuer `G...` public key.
 * @property {string} [domain] - Issuer home domain, e.g. `centre.io`.
 * @property {string} [homeDomain] - Alias for `domain`.
 * @property {boolean} [isNative] - True when the asset is native XLM.
 */

/**
 * Validate an optional length option.
 *
 * @param {number|undefined} value
 * @param {string} name option name used in the error message
 * @param {number} fallback value used when the option is omitted
 * @returns {number}
 * @throws {Error} when the value is not a non-negative integer
 */
function normalizeLength(value, name, fallback) {
  if (value === undefined) return fallback;

  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }

  return value;
}

/**
 * Resolve the issuer shortening lengths from the caller options.
 *
 * @param {Object} [options]
 * @param {number} [options.prefixLength=6]
 * @param {number} [options.suffixLength=6]
 * @returns {{ prefixLength: number, suffixLength: number }}
 * @throws {Error} when a length is invalid or both lengths are zero
 */
function resolveLengths(options = {}) {
  const opts = options ?? {};
  const prefixLength = normalizeLength(
    opts.prefixLength,
    "prefixLength",
    DEFAULT_ISSUER_PREFIX_LENGTH
  );
  const suffixLength = normalizeLength(
    opts.suffixLength,
    "suffixLength",
    DEFAULT_ISSUER_SUFFIX_LENGTH
  );

  if (prefixLength + suffixLength === 0) {
    throw new Error("prefixLength and suffixLength cannot both be 0.");
  }

  return { prefixLength, suffixLength };
}

/**
 * Normalize an asset code: trimmed and uppercased.
 *
 * @param {string} code
 * @returns {string} the canonical uppercase code
 * @throws {TypeError} when the code is not a string
 * @throws {Error} when the code is missing, empty, or not 1–12 alphanumeric
 *   characters
 */
function normalizeAssetCode(code) {
  if (code === undefined || code === null) {
    throw new Error("Asset code is required.");
  }

  if (typeof code !== "string") {
    throw new TypeError("Asset code must be a string.");
  }

  const trimmed = code.trim();
  if (!trimmed) {
    throw new Error("Asset code is required.");
  }

  const upper = trimmed.toUpperCase();
  if (!ASSET_CODE.test(upper)) {
    throw new Error(
      `Asset code must be 1–${MAX_ASSET_CODE_LENGTH} alphanumeric characters (A–Z, 0–9).`
    );
  }

  return upper;
}

/**
 * Normalize an issuer address: trimmed, validated as a Stellar public key.
 *
 * The StrKey checksum is not verified here — that is left to the SDK.
 *
 * @param {string} issuer
 * @returns {string} the trimmed issuer address
 * @throws {TypeError} when the issuer is not a string
 * @throws {Error} when the issuer is missing, empty, or not a `G...` public key
 */
function normalizeIssuer(issuer) {
  if (issuer === undefined || issuer === null) {
    throw new Error("Asset issuer is required.");
  }

  if (typeof issuer !== "string") {
    throw new TypeError("Asset issuer must be a string.");
  }

  const trimmed = issuer.trim();
  if (!trimmed) {
    throw new Error("Asset issuer is required.");
  }

  if (!STELLAR_PUBLIC_KEY.test(trimmed)) {
    throw new Error("Asset issuer must be a valid Stellar public key (G…).");
  }

  return trimmed;
}

/**
 * Normalize an issuer home domain: trimmed and lowercased.
 *
 * An empty or whitespace-only domain means "no domain is known" and returns
 * `null`, which makes the caller fall back to the shortened issuer.
 *
 * @param {string} domain
 * @returns {string|null} the normalized domain, or `null` when unknown
 * @throws {TypeError} when the domain is not a string
 * @throws {Error} when the domain is not a valid domain name
 */
function normalizeDomain(domain) {
  if (typeof domain !== "string") {
    throw new TypeError("Asset home domain must be a string.");
  }

  const value = domain.trim().toLowerCase();
  if (!value) return null;

  if (value.length > MAX_DOMAIN_LENGTH) {
    throw new Error(
      `Asset home domain cannot exceed ${MAX_DOMAIN_LENGTH} characters.`
    );
  }

  const labels = value.split(".");
  if (labels.length < 2) {
    throw new Error("Asset home domain must include a top-level domain.");
  }

  for (const label of labels) {
    if (!DOMAIN_LABEL.test(label)) {
      throw new Error("Asset home domain contains an invalid label.");
    }
  }

  const tld = labels[labels.length - 1];
  if (!/[a-z]/.test(tld)) {
    throw new Error("Asset home domain must end with a valid top-level domain.");
  }

  return value;
}

/**
 * Read the home domain from an asset descriptor.
 *
 * `domain` wins over the `homeDomain` alias when both carry a value; a
 * missing (`undefined`/`null`) `domain` falls back to the alias.
 *
 * @param {AssetIssuerDisplayInput} asset
 * @returns {string|undefined} the raw domain, or `undefined` when absent
 */
function readDomain(asset) {
  if (asset.domain !== undefined && asset.domain !== null) return asset.domain;
  if (asset.homeDomain !== undefined && asset.homeDomain !== null) {
    return asset.homeDomain;
  }
  return undefined;
}

/**
 * Shorten an issuer address for display.
 *
 * Behaviour:
 * - Surrounding whitespace is trimmed before validation.
 * - When the address already fits within `prefixLength + suffixLength`, it is
 *   returned unchanged (no ellipsis).
 * - A zero-length side is omitted, so `{ prefixLength: 4, suffixLength: 0 }`
 *   yields `GABC…`.
 *
 * @param {string} issuer Stellar `G...` public key
 * @param {Object} [options]
 * @param {number} [options.prefixLength=6] characters kept from the start
 * @param {number} [options.suffixLength=6] characters kept from the end
 * @returns {string} shortened issuer, e.g. `GAAAAA…AAAWHF`
 * @throws {TypeError} when the issuer is not a string
 * @throws {Error} when the issuer is missing, malformed, or a length is not a
 *   non-negative integer
 */
export function shortenIssuer(issuer, options = {}) {
  const value = normalizeIssuer(issuer);
  const { prefixLength, suffixLength } = resolveLengths(options);

  if (value.length <= prefixLength + suffixLength) return value;

  const prefix = value.slice(0, prefixLength);
  const suffix = suffixLength ? value.slice(-suffixLength) : "";

  return `${prefix}${ISSUER_ELLIPSIS}${suffix}`;
}

/**
 * Format the issuer part of an asset label, including its parentheses.
 *
 * The home domain is used when it is known; otherwise the issuer address is
 * shortened as the fallback. The issuer is always validated, even when a domain
 * is known.
 *
 * @param {string} issuer Stellar `G...` public key
 * @param {string} [domain] issuer home domain, e.g. `centre.io`
 * @param {Object} [options]
 * @param {number} [options.prefixLength=6] characters kept from the start
 * @param {number} [options.suffixLength=6] characters kept from the end
 * @returns {string} parenthesized issuer, e.g. `(centre.io)`
 * @throws {TypeError} when the issuer or domain is not a string
 * @throws {Error} when the issuer is missing/malformed or the domain invalid
 */
export function formatIssuerWithDomain(issuer, domain, options = {}) {
  const normalizedIssuer = normalizeIssuer(issuer);
  const normalizedDomain = domain === undefined || domain === null
    ? null
    : normalizeDomain(domain);

  if (normalizedDomain) return `(${normalizedDomain})`;

  return `(${shortenIssuer(normalizedIssuer, options)})`;
}

/**
 * Format an asset for display in an asset list.
 *
 * Behaviour:
 * - The code is trimmed and uppercased; a missing code is an error for credit
 *   assets and defaults to `XLM` for native assets.
 * - Native assets (no issuer) render as the code alone.
 * - Credit assets render as `CODE (domain)` when the issuer's home domain is
 *   known, or `CODE (GAAAAA…AAAWHF)` when it is not.
 *
 * @param {AssetIssuerDisplayInput} asset asset descriptor
 * @param {Object} [options]
 * @param {number} [options.prefixLength=6] characters kept from the issuer start
 * @param {number} [options.suffixLength=6] characters kept from the issuer end
 * @returns {string} display string, e.g. `USDC (centre.io)`
 * @throws {TypeError} when the asset or one of its fields has the wrong type
 * @throws {Error} when the code, issuer, or domain is invalid
 *
 * @example
 * formatAssetIssuerDomain({ code: "USDC", issuer: "G...", domain: "centre.io" })
 * // => "USDC (centre.io)"
 *
 * formatAssetIssuerDomain({ code: "USDC", issuer: "G..." })
 * // => "USDC (GAAAAA…AAAWHF)"
 */
export function formatAssetIssuerDomain(asset, options = {}) {
  if (asset === null || typeof asset !== "object" || Array.isArray(asset)) {
    throw new TypeError("Asset must be an object.");
  }

  const isNative = asset.isNative === true;
  const code = normalizeAssetCode(
    isNative && (asset.code === undefined || asset.code === null) ? "XLM" : asset.code
  );

  if (isNative) return code;

  return `${code} ${formatIssuerWithDomain(asset.issuer, readDomain(asset), options)}`;
}
