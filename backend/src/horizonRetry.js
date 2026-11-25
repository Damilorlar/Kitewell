/**
 * Wrap a Horizon fetch call with retry and exponential backoff, up to a
 * configurable max-attempt count. Standalone module: not imported into
 * `app.js`, `index.js`, or any route in this change.
 */

export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_BASE_DELAY_MS = 200;
export const DEFAULT_FACTOR = 2;

/**
 * Call `fn(attempt)` (1-indexed), retrying with exponential backoff on
 * rejection until `maxAttempts` is reached or `shouldRetry(error)` returns
 * `false`, then rethrow the last error.
 *
 * @template T
 * @param {(attempt: number) => Promise<T>} fn
 * @param {object} [options]
 * @param {number} [options.maxAttempts] total attempts, including the
 *   first; must be an integer >= 1.
 * @param {number} [options.baseDelayMs] delay before the 2nd attempt.
 * @param {number} [options.factor] multiplier applied after each failure.
 * @param {number} [options.maxDelayMs] upper bound on any single delay.
 * @param {(error: unknown) => boolean} [options.shouldRetry] return
 *   `false` to stop retrying immediately. Defaults to always retrying.
 * @param {(ms: number) => Promise<void>} [options.sleep] injectable delay,
 *   primarily for tests.
 * @returns {Promise<T>}
 */
export async function withHorizonRetry(fn, options = {}) {
  const {
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    factor = DEFAULT_FACTOR,
    maxDelayMs = Infinity,
    shouldRetry = () => true,
    sleep = defaultSleep,
  } = options;

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError("maxAttempts must be an integer >= 1");
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts;
      if (isLastAttempt || !shouldRetry(error)) {
        throw error;
      }
      const delay = computeRetryDelayMs(attempt, baseDelayMs, factor, maxDelayMs);
      await sleep(delay);
    }
  }

  // Unreachable: the loop above always returns or throws.
  throw new Error("withHorizonRetry: unreachable");
}

/**
 * Compute the exponential backoff delay (ms) before the attempt that
 * follows the given one, capped at `maxDelayMs`.
 *
 * @param {number} attempt 1-indexed attempt number that just failed.
 * @param {number} [baseDelayMs]
 * @param {number} [factor]
 * @param {number} [maxDelayMs]
 * @returns {number}
 */
export function computeRetryDelayMs(
  attempt,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
  factor = DEFAULT_FACTOR,
  maxDelayMs = Infinity
) {
  const raw = baseDelayMs * factor ** (attempt - 1);
  return Math.min(raw, maxDelayMs);
}

function defaultSleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
