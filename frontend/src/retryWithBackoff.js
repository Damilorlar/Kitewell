/**
 * Retry an async function with exponential backoff, up to a configurable
 * max-attempt cap. Intended for flaky Horizon calls that occasionally fail
 * transiently.
 *
 * @template T
 * @param {(attempt: number) => Promise<T>} fn called once per attempt
 *   (1-indexed); its resolved value is returned on success.
 * @param {object} [options]
 * @param {number} [options.maxAttempts=3] total attempts, including the
 *   first; must be at least 1.
 * @param {number} [options.baseDelayMs=200] delay before the 2nd attempt.
 * @param {number} [options.factor=2] multiplier applied to the delay after
 *   each failed attempt.
 * @param {number} [options.maxDelayMs=Infinity] upper bound on any single
 *   delay.
 * @param {(error: unknown) => boolean} [options.shouldRetry] called with
 *   the error from a failed attempt; returning `false` stops retrying and
 *   rethrows immediately. Defaults to always retrying.
 * @param {(ms: number) => Promise<void>} [options.sleep] injectable delay
 *   function, primarily for tests.
 * @returns {Promise<T>}
 * @throws the last error once `maxAttempts` is reached, or sooner if
 *   `shouldRetry` returns `false`.
 */
export async function retryWithBackoff(fn, options = {}) {
  const {
    maxAttempts = 3,
    baseDelayMs = 200,
    factor = 2,
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
      const delay = computeBackoffDelay(attempt, baseDelayMs, factor, maxDelayMs);
      await sleep(delay);
    }
  }

  // Unreachable: the loop above always returns or throws.
  throw new Error("retryWithBackoff: unreachable");
}

/**
 * Compute the exponential backoff delay (in ms) before the attempt that
 * follows the given one, capped at `maxDelayMs`.
 *
 * @param {number} attempt 1-indexed attempt number that just failed.
 * @param {number} [baseDelayMs=200]
 * @param {number} [factor=2]
 * @param {number} [maxDelayMs=Infinity]
 * @returns {number}
 */
export function computeBackoffDelay(attempt, baseDelayMs = 200, factor = 2, maxDelayMs = Infinity) {
  const raw = baseDelayMs * factor ** (attempt - 1);
  return Math.min(raw, maxDelayMs);
}

function defaultSleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
