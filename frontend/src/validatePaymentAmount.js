/**
 * Validate a payment amount string before it reaches Freighter/Horizon.
 *
 * Rule (the single source of truth for amount shape):
 *   1. Non-empty after trimming.
 *   2. Plain decimal digits only — `123` or `123.45`. No sign, exponent,
 *      thousands separator, or leading-dot form (`.5` is rejected).
 *   3. At most 7 decimal places, matching Stellar's stroop precision
 *      (1 XLM = 10^7 stroops).
 *   4. Strictly greater than zero (e.g. `0`, `0.0`, `0.0000000` are rejected).
 *
 * Returns the trimmed amount string on success and throws an `Error` with a
 * human-readable message on failure, mirroring the throw-based style of
 * `normalizeAmount` in freighter.js. Credit-asset-specific rules and path
 * payment bounds are out of scope.
 *
 * @param {string|number} value
 * @param {string} label used in error messages
 * @returns {string} the validated, trimmed amount
 */
export function validatePaymentAmount(value, label = "Amount") {
  const text = String(value ?? "").trim();

  if (!text) {
    throw new Error(`${label} is required.`);
  }

  if (!/^\d+(\.\d+)?$/.test(text)) {
    throw new Error(`${label} must be a positive number, e.g. 10 or 0.5.`);
  }

  const [, fraction = ""] = text.split(".");
  if (fraction.length > 7) {
    throw new Error(`${label} supports at most 7 decimal places.`);
  }

  if (!/[1-9]/.test(text)) {
    throw new Error(`${label} must be greater than zero.`);
  }

  return text;
}
