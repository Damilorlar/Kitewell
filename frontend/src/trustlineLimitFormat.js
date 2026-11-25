/**
 * Trustline limit formatter/validator.
 *
 * Formats and validates a trustline limit string for Stellar's changeTrust
 * operation. Handles three cases:
 *   - Default max limit (no input or "max") → "922337203685.4775807" (INT64_MAX / 10^7)
 *   - Custom numeric limit → normalized to 7 decimal places
 *   - "0" or "zero" → "0.0000000" (special case to remove trustline)
 *
 * @module trustlineLimitFormat
 */

/** Maximum trustline limit in XLM (INT64_MAX stroops / 10^7). */
export const MAX_TRUSTLINE_LIMIT = "922337203685.4775807";

/** Default trustline limit used by the SDK when none is specified. */
export const DEFAULT_TRUSTLINE_LIMIT = "1000000.0000000";

/**
 * Result of formatting a trustline limit.
 * @typedef {Object} TrustlineLimitResult
 * @property {string} formatted - The limit formatted to 7 decimal places for the SDK.
 * @property {"default" | "custom" | "zero"} type - The type of limit.
 * @property {boolean} isZero - True when the limit is zero (removes trustline).
 * @property {boolean} isDefault - True when the limit is the default max.
 */

/**
 * Compare two decimal strings numerically without floating point precision loss.
 * @param {string} a - First decimal string
 * @param {string} b - Second decimal string
 * @returns {number} -1 if a < b, 0 if a === b, 1 if a > b
 */
function compareDecimalStrings(a, b) {
  const [aWhole, aFrac = ""] = a.split(".");
  const [bWhole, bFrac = ""] = b.split(".");

  // Compare whole parts
  const aWholeNum = BigInt(aWhole);
  const bWholeNum = BigInt(bWhole);
  if (aWholeNum < bWholeNum) return -1;
  if (aWholeNum > bWholeNum) return 1;

  // Compare fractional parts (pad to same length)
  const maxFracLen = Math.max(aFrac.length, bFrac.length);
  const aFracPadded = (aFrac + "0".repeat(maxFracLen)).slice(0, maxFracLen);
  const bFracPadded = (bFrac + "0".repeat(maxFracLen)).slice(0, maxFracLen);

  if (aFracPadded < bFracPadded) return -1;
  if (aFracPadded > bFracPadded) return 1;
  return 0;
}

/**
 * Normalize a numeric string: remove leading zeros from whole part.
 * @param {string} text - Numeric string
 * @returns {string} Normalized numeric string
 */
function normalizeNumericString(text) {
  const [whole, fraction = ""] = text.split(".");
  // Remove leading zeros from whole part, but keep at least one digit
  const normalizedWhole = whole.replace(/^0+/, "") || "0";
  return fraction ? `${normalizedWhole}.${fraction}` : normalizedWhole;
}

/**
 * Format and validate a trustline limit string.
 *
 * Accepts:
 *   - Empty/undefined/null/whitespace → returns default max limit
 *   - "max" (case-insensitive) → returns default max limit
 *   - "0", "0.0", "0.0000000", "zero" (case-insensitive) → returns zero (removes trustline)
 *   - Positive numeric string → normalizes to 7 decimal places
 *
 * @param {string|number|null|undefined} limit - The limit value from the UI.
 * @returns {TrustlineLimitResult} Formatted limit with metadata.
 *
 * @throws {Error} If the limit is negative, exceeds MAX_TRUSTLINE_LIMIT,
 *   has more than 7 decimal places, or is not a valid number.
 *
 * @example
 * formatTrustlineLimit()                    // => { formatted: "1000000.0000000", type: "default", isZero: false, isDefault: true }
 * formatTrustlineLimit("max")               // => { formatted: "922337203685.4775807", type: "default", isZero: false, isDefault: true }
 * formatTrustlineLimit("0")                 // => { formatted: "0.0000000", type: "zero", isZero: true, isDefault: false }
 * formatTrustlineLimit("1.5")               // => { formatted: "1.5000000", type: "custom", isZero: false, isDefault: false }
 * formatTrustlineLimit("1000000")           // => { formatted: "1000000.0000000", type: "default", isZero: false, isDefault: true }
 */
export function formatTrustlineLimit(limit) {
  // Handle empty/undefined/null/whitespace → default
  if (limit === undefined || limit === null || String(limit).trim() === "") {
    return {
      formatted: DEFAULT_TRUSTLINE_LIMIT,
      type: "default",
      isZero: false,
      isDefault: true,
    };
  }

  const text = String(limit).trim().toLowerCase();

  // Handle "max" keyword
  if (text === "max") {
    return {
      formatted: MAX_TRUSTLINE_LIMIT,
      type: "default",
      isZero: false,
      isDefault: true,
    };
  }

  // Handle zero cases (remove trustline)
  if (text === "0" || text === "0.0" || text === "0.0000000" || text === "zero") {
    return {
      formatted: "0.0000000",
      type: "zero",
      isZero: true,
      isDefault: false,
    };
  }

  // Check for negative sign before regex validation
  if (text.startsWith("-")) {
    throw new Error("Trustline limit cannot be negative.");
  }

  // Validate numeric format
  if (!/^\d+(\.\d+)?$/.test(text)) {
    throw new Error("Trustline limit must be a non-negative number, 'max', or 'zero'.");
  }

  // Check decimal places
  const [, fraction = ""] = text.split(".");
  if (fraction.length > 7) {
    throw new Error("Trustline limit supports at most 7 decimal places.");
  }

  // Normalize the numeric string (remove leading zeros)
  const normalizedText = normalizeNumericString(text);

  // Check if normalized value is zero (e.g., "000000" -> "0")
  if (normalizedText === "0" || normalizedText === "0.0" || normalizedText === "0.0000000") {
    return {
      formatted: "0.0000000",
      type: "zero",
      isZero: true,
      isDefault: false,
    };
  }

  // Check range using string comparison to avoid floating point precision issues
  if (compareDecimalStrings(normalizedText, MAX_TRUSTLINE_LIMIT) > 0) {
    throw new Error(`Trustline limit cannot exceed ${MAX_TRUSTLINE_LIMIT}.`);
  }

  // Normalize to 7 decimal places
  const [whole, normFraction = ""] = normalizedText.split(".");
  const normalizedFraction = (normFraction + "0000000").slice(0, 7);
  const formatted = `${whole}.${normalizedFraction}`;

  // Check if it's the default limit (value equals DEFAULT_TRUSTLINE_LIMIT)
  const isDefault = formatted === DEFAULT_TRUSTLINE_LIMIT;

  return {
    formatted,
    type: isDefault ? "default" : "custom",
    isZero: false,
    isDefault,
  };
}

/**
 * Validate a trustline limit without formatting.
 * Useful for real-time UI validation.
 *
 * @param {string|number|null|undefined} limit - The limit value from the UI.
 * @returns {Object} Validation result.
 * @returns {boolean} returns.valid - True if valid.
 * @returns {string[]} returns.errors - Array of error messages (empty if valid).
 *
 * @example
 * validateTrustlineLimit("1.5")     // => { valid: true, errors: [] }
 * validateTrustlineLimit("-5")      // => { valid: false, errors: ["Trustline limit cannot be negative."] }
 * validateTrustlineLimit("1.12345678") // => { valid: false, errors: ["Trustline limit supports at most 7 decimal places."] }
 */
export function validateTrustlineLimit(limit) {
  const errors = [];

  if (limit === undefined || limit === null || String(limit).trim() === "") {
    return { valid: true, errors: [] }; // Default is valid
  }

  const text = String(limit).trim().toLowerCase();

  if (text === "max" || text === "0" || text === "0.0" || text === "0.0000000" || text === "zero") {
    return { valid: true, errors: [] };
  }

  // Check for negative sign before regex validation
  if (text.startsWith("-")) {
    errors.push("Trustline limit cannot be negative.");
    return { valid: false, errors };
  }

  if (!/^\d+(\.\d+)?$/.test(text)) {
    errors.push("Trustline limit must be a non-negative number, 'max', or 'zero'.");
    return { valid: false, errors };
  }

  const [, fraction = ""] = text.split(".");
  if (fraction.length > 7) {
    errors.push("Trustline limit supports at most 7 decimal places.");
  }

  // Normalize and check range
  const normalizedText = normalizeNumericString(text);
  if (compareDecimalStrings(normalizedText, MAX_TRUSTLINE_LIMIT) > 0) {
    errors.push(`Trustline limit cannot exceed ${MAX_TRUSTLINE_LIMIT}.`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Parse a formatted trustline limit back to a human-readable string.
 * Removes trailing zeros after the decimal point for display.
 *
 * @param {string} formattedLimit - The 7-decimal formatted limit from formatTrustlineLimit.
 * @returns {string} Human-readable limit string.
 *
 * @example
 * parseTrustlineLimit("1000000.0000000")  // => "1000000"
 * parseTrustlineLimit("1.5000000")        // => "1.5"
 * parseTrustlineLimit("0.0000000")        // => "0"
 */
export function parseTrustlineLimit(formattedLimit) {
  const text = String(formattedLimit ?? "").trim();
  if (!text) return "0";

  // Handle malformed input gracefully
  if (!/^-?\d+(\.\d+)?$/.test(text)) {
    return "0";
  }

  const [whole, fraction = ""] = text.split(".");
  const trimmedFraction = fraction.replace(/0+$/, "");

  if (trimmedFraction === "") {
    return whole;
  }
  return `${whole}.${trimmedFraction}`;
}