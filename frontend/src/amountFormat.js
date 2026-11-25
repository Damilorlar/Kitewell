const STROOPS_PER_XLM = 10_000_000n;
const DECIMAL_AMOUNT = /^(\d+)(?:([.,])(\d{0,7}))?$/;

/**
 * Convert a non-negative decimal XLM amount to exact integer stroops.
 *
 * A single period or comma may be used as the decimal separator. Grouping
 * separators, signs, and more than seven fractional digits are rejected.
 *
 * @param {string} amount Decimal amount, for example `"1.25"` or `"1,25"`.
 * @returns {bigint} The exact amount in stroops.
 * @throws {TypeError|RangeError} When the input is not a supported amount.
 */
export function toStroops(amount) {
  if (typeof amount !== "string") {
    throw new TypeError("Amount must be a decimal string.");
  }

  const value = amount.trim();
  const match = DECIMAL_AMOUNT.exec(value);
  if (!match) {
    throw new RangeError("Amount must be a non-negative decimal with at most 7 fractional digits.");
  }

  const whole = match[1];
  const fraction = (match[3] ?? "").padEnd(7, "0");
  return BigInt(whole) * STROOPS_PER_XLM + BigInt(fraction || "0");
}

/**
 * Format integer stroops as a canonical decimal XLM string.
 *
 * Accepts a bigint, an integer string, or a safe integer number. Trailing
 * fractional zeros are removed; whole XLM values have no decimal point.
 *
 * @param {bigint|number|string} stroops Non-negative integer stroop amount.
 * @returns {string} Canonical decimal XLM amount.
 * @throws {TypeError|RangeError} When the input is not a non-negative integer.
 */
export function formatStroops(stroops) {
  let value;
  if (typeof stroops === "bigint") {
    value = stroops;
  } else if (typeof stroops === "number" && Number.isSafeInteger(stroops)) {
    value = BigInt(stroops);
  } else if (typeof stroops === "string" && /^\d+$/.test(stroops.trim())) {
    value = BigInt(stroops.trim());
  } else {
    throw new TypeError("Stroops must be a non-negative integer.");
  }

  if (value < 0n) {
    throw new RangeError("Stroops cannot be negative.");
  }

  const whole = value / STROOPS_PER_XLM;
  const fraction = (value % STROOPS_PER_XLM)
    .toString()
    .padStart(7, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}