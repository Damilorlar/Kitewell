/**
 * Address shortener.
 *
 * Renders a Stellar `G...` public key as `GABC...WXYZ` so long identifiers fit
 * in table cells and toasts. Prefix and suffix lengths are configurable and the
 * input is validated, so a malformed value fails loudly instead of rendering a
 * misleading "short" string.
 *
 * This module is standalone: nothing in `App.jsx`, `freighter.js`, or
 * `stellar.js` imports it yet. Unlike `./addressFormat`, which is a lenient
 * display helper, this one throws on invalid input (matching the throw-based
 * style of `./validateAssetCode`).
 */

/** Ellipsis inserted between the kept prefix and suffix. */
export const ELLIPSIS = "…";

export const DEFAULT_PREFIX_LENGTH = 6;
export const DEFAULT_SUFFIX_LENGTH = 6;

/**
 * Canonical shape of a Stellar ed25519 public key. The StrKey checksum is not
 * verified here — that is left to the SDK.
 */
const STELLAR_ADDRESS = /^G[A-Z2-7]+$/;

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
 * Shorten a Stellar address for display.
 *
 * Behaviour:
 * - Surrounding whitespace is trimmed before validation.
 * - When the address already fits within `prefixLength + suffixLength`, it is
 *   returned unchanged (no ellipsis).
 * - A zero-length side is omitted, so `{ prefixLength: 4, suffixLength: 0 }`
 *   yields `GABC…`.
 *
 * @param {string} address Stellar `G...` public key
 * @param {object} [options]
 * @param {number} [options.prefixLength=6] characters kept from the start
 * @param {number} [options.suffixLength=6] characters kept from the end
 * @returns {string} shortened address, e.g. `GABC...WXYZ`
 * @throws {Error} when the address is missing, malformed, or a length is not a
 *   non-negative integer
 */
export function shortenAddress(address, options = {}) {
  if (typeof address !== "string") {
    throw new Error("Address must be a string.");
  }

  const value = address.trim();

  if (!value) {
    throw new Error("Address is required.");
  }

  if (!STELLAR_ADDRESS.test(value)) {
    throw new Error("Invalid Stellar address. Expected a G... public key.");
  }

  const opts = options ?? {};
  const prefixLength = normalizeLength(
    opts.prefixLength,
    "prefixLength",
    DEFAULT_PREFIX_LENGTH
  );
  const suffixLength = normalizeLength(
    opts.suffixLength,
    "suffixLength",
    DEFAULT_SUFFIX_LENGTH
  );

  if (prefixLength + suffixLength === 0) {
    throw new Error("prefixLength and suffixLength cannot both be 0.");
  }

  if (value.length <= prefixLength + suffixLength) return value;

  const prefix = value.slice(0, prefixLength);
  const suffix = suffixLength ? value.slice(-suffixLength) : "";

  return `${prefix}${ELLIPSIS}${suffix}`;
}
