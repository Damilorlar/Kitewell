/**
 * Account sequence staleness check.
 *
 * Compares a cached sequence number against a freshly fetched one to detect
 * whether the cached value has become stale (i.e., the account has submitted
 * transactions since the cache was populated).
 *
 * On Stellar, every transaction increments the account's sequence number by 1.
 * A cached sequence that is lower than the current on-chain sequence indicates
 * the cache is out of date.
 *
 * @module sequenceGapCheck
 */

/**
 * Result of a sequence gap check.
 * @typedef {Object} SequenceGapResult
 * @property {boolean} stale - True when the cached sequence is lower than the
 *   freshly fetched sequence (i.e., the cache is out of date).
 * @property {string} cached - The cached sequence number (normalized to string).
 * @property {string} current - The freshly fetched sequence number (normalized to string).
 * @property {number} gap - The difference `current - cached` (>= 0 when stale).
 */

/**
 * Compare a cached sequence number against the current on-chain sequence.
 *
 * @param {string|number} cachedSequence - The sequence number from the local
 *   cache (as a string or number).
 * @param {string|number} currentSequence - The sequence number freshly fetched
 *   from Horizon (as a string or number).
 * @returns {SequenceGapResult} An object describing whether the cache is stale
 *   and the numeric gap between the two values.
 *
 * @throws {Error} If either input is missing, not a valid integer string/number,
 *   or represents a negative value.
 *
 * @example
 * // Cache is fresh (no gap)
 * checkSequenceGap("100", "100")
 * // => { stale: false, cached: "100", current: "100", gap: 0 }
 *
 * @example
 * // Cache is stale by 3 transactions
 * checkSequenceGap("100", "103")
 * // => { stale: true, cached: "100", current: "103", gap: 3 }
 */
export function checkSequenceGap(cachedSequence, currentSequence) {
  if (cachedSequence === undefined || cachedSequence === null || cachedSequence === "") {
    throw new Error("Cached sequence is required.");
  }
  if (currentSequence === undefined || currentSequence === null || currentSequence === "") {
    throw new Error("Current sequence is required.");
  }

  const cachedStr = String(cachedSequence).trim();
  const currentStr = String(currentSequence).trim();

  if (!/^\d+$/.test(cachedStr)) {
    throw new Error("Cached sequence must be a non-negative integer.");
  }
  if (!/^\d+$/.test(currentStr)) {
    throw new Error("Current sequence must be a non-negative integer.");
  }

  const cached = BigInt(cachedStr);
  const current = BigInt(currentStr);

  if (cached < 0n || current < 0n) {
    throw new Error("Sequence numbers must be non-negative.");
  }

  const stale = cached < current;
  const gap = stale ? Number(current - cached) : 0;

  return {
    stale,
    cached: cachedStr,
    current: currentStr,
    gap,
  };
}

/**
 * Check if a cached sequence is fresh (not stale).
 *
 * Convenience wrapper around `checkSequenceGap` that returns a simple boolean.
 *
 * @param {string|number} cachedSequence - The sequence number from the local cache.
 * @param {string|number} currentSequence - The sequence number freshly fetched from Horizon.
 * @returns {boolean} True when the cached sequence matches the current sequence
 *   (i.e., the cache is up to date), false otherwise.
 *
 * @throws {Error} If either input is invalid (same validation as `checkSequenceGap`).
 *
 * @example
 * isSequenceFresh("100", "100") // => true
 * isSequenceFresh("100", "101") // => false
 */
export function isSequenceFresh(cachedSequence, currentSequence) {
  return !checkSequenceGap(cachedSequence, currentSequence).stale;
}