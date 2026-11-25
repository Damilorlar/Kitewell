/**
 * Validate a trustline asset code before it reaches Freighter/Horizon.
 *
 * Charset rule: a Stellar asset code is 1–12 characters drawn from the
 * alphanumeric set `A–Z`, `a–z`, `0–9`. No spaces, punctuation, or other
 * symbols are allowed. Codes are case-insensitive on the wire but canonically
 * uppercase, so this helper normalizes mixed case to uppercase and returns it
 * ready for `Asset`.
 *
 * Returns the trimmed, uppercased code on success and throws an `Error` with a
 * human-readable message on failure, mirroring the throw-based style used
 * elsewhere in the frontend. Remove-trustline (#3) and issuer UX beyond
 * existing StrKey checks are out of scope.
 *
 * @param {string} value
 * @param {string} label used in error messages
 * @returns {string} the validated, uppercased code
 */
export function validateAssetCode(value, label = "Asset code") {
  const text = String(value ?? "").trim();

  if (!text) {
    throw new Error(`${label} is required.`);
  }

  if (!/^[A-Za-z0-9]{1,12}$/.test(text)) {
    throw new Error(
      `${label} must be 1–12 alphanumeric characters (A–Z, 0–9).`
    );
  }

  return text.toUpperCase();
}
