/**
 * Persisted per-operation fee selection.
 *
 * The composer UI stores either a Horizon fee-stats percentile (`mode`, `p10`,
 * `p99`) or a typed fee (`custom`). The numeric stroop value is stored too, so
 * the selection still applies after a reload before fee stats are fetched.
 */

export const FEE_STORAGE_KEY = "kitewell.fee";

export const FEE_SOURCES = ["mode", "p10", "p99", "custom"];

const MAX_FEE_STROOPS = (1n << 63n) - 1n;

/**
 * Validate a fee and return it as a canonical decimal string.
 *
 * @param {string|number|bigint} value Stroops per operation.
 * @returns {string} Normalized stroop count.
 * @throws {Error} For empty, fractional, zero, negative, or oversized values.
 */
export function parseFeeStroops(value) {
  const text = String(value ?? "").trim();

  if (!/^\d+$/.test(text)) {
    throw new Error("Fee must be a whole number of stroops.");
  }

  const stroops = BigInt(text);
  if (stroops <= 0n) {
    throw new Error("Fee must be greater than zero.");
  }
  if (stroops > MAX_FEE_STROOPS) {
    throw new Error("Fee is too large.");
  }

  return stroops.toString();
}

/**
 * Read the saved fee selection, or null when there is none/invalid data.
 *
 * @returns {{source: string, stroops: string}|null}
 */
export function loadFeeSetting() {
  try {
    const raw = globalThis.localStorage?.getItem(FEE_STORAGE_KEY);
    if (!raw) return null;

    const saved = JSON.parse(raw);
    if (!saved || !FEE_SOURCES.includes(saved.source)) return null;

    return {
      source: saved.source,
      stroops: parseFeeStroops(saved.stroops),
    };
  } catch {
    return null;
  }
}

/**
 * Validate and persist a fee selection. Storage failures are best-effort and
 * do not discard the in-memory selection.
 *
 * @param {{source: string, stroops: string|number|bigint}} setting
 * @returns {{source: string, stroops: string}}
 */
export function saveFeeSetting({ source, stroops } = {}) {
  if (!FEE_SOURCES.includes(source)) {
    throw new Error("Choose mode, p10, p99, or a custom fee.");
  }

  const normalized = {
    source,
    stroops: parseFeeStroops(stroops),
  };

  try {
    globalThis.localStorage?.setItem(FEE_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    /* persistence is best-effort; the current session still uses the choice */
  }

  return normalized;
}

/**
 * The selected fee per operation, or null when the SDK default should be used.
 *
 * @returns {string|null}
 */
export function getFeePerOperation() {
  return loadFeeSetting()?.stroops ?? null;
}
