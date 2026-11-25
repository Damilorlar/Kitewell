import { RequestTimeoutError } from "./requestTimeoutErrors.js";

export { RequestTimeoutError } from "./requestTimeoutErrors.js";

/**
 * Reject timeouts that cannot be scheduled.
 * Checks run in order: type, finiteness, integer, then positive.
 * A failure throws and does not arm a timer.
 *
 * @param {unknown} timeoutMs
 * @returns {void}
 */
function assertValidTimeoutMs(timeoutMs) {
  if (typeof timeoutMs !== "number") {
    throw new RequestTimeoutError(
      "timeoutMs must be a positive integer number of milliseconds",
      { timeoutMs, reason: "invalid-type" },
    );
  }

  if (!Number.isFinite(timeoutMs)) {
    throw new RequestTimeoutError(
      "timeoutMs must be a finite number of milliseconds",
      { timeoutMs, reason: "non-finite" },
    );
  }

  if (!Number.isInteger(timeoutMs)) {
    throw new RequestTimeoutError(
      "timeoutMs must be an integer number of milliseconds",
      { timeoutMs, reason: "non-integer" },
    );
  }

  if (timeoutMs <= 0) {
    throw new RequestTimeoutError(
      "timeoutMs must be a positive integer number of milliseconds",
      { timeoutMs, reason: "non-positive" },
    );
  }
}

/**
 * Build Express middleware that caps how long one request may run.
 *
 * The returned handler calls `next()` immediately and arms a timer for
 * `timeoutMs` milliseconds. If the response ends first (`finish` or `close`),
 * the timer is cleared. If the timer fires while `res.headersSent` is still
 * false, the middleware answers with HTTP 408 and
 * `{ error: "request_timeout", timeoutMs }`.
 *
 * This factory is standalone. It does not mount itself on an application.
 *
 * @param {number} timeoutMs Positive integer duration in milliseconds.
 * @param {object} [options]
 * @param {typeof setTimeout} [options.setTimer] Timer scheduler. Defaults to
 *   the global `setTimeout`. Tests inject a fake so the suite never sleeps.
 * @param {typeof clearTimeout} [options.clearTimer] Timer canceller. Defaults
 *   to the global `clearTimeout`. Must match `setTimer`.
 * @returns {(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => void}
 *   Per-request middleware. Each call gets its own timer.
 */
export function requestTimeout(timeoutMs, options) {
  assertValidTimeoutMs(timeoutMs);

  const opts = options == null ? {} : options;
  const setTimer = opts.setTimer ?? setTimeout;
  const clearTimer = opts.clearTimer ?? clearTimeout;

  return function requestTimeoutMiddleware(req, res, next) {
    let cleared = false;

    const timer = setTimer(() => {
      if (cleared) return;
      cleared = true;
      if (res.headersSent) return;
      res.status(408).json({
        error: "request_timeout",
        timeoutMs,
      });
    }, timeoutMs);

    const onDone = () => {
      if (cleared) return;
      cleared = true;
      clearTimer(timer);
    };

    res.on("finish", onDone);
    res.on("close", onDone);
    next();
  };
}
