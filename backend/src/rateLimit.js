/**
 * Fixed-window per-IP rate limiting, in-memory and dependency-free.
 *
 * Exported as a factory so each app gets its own bucket map (no shared state
 * between instances or test runs) and so tests can drive a fake clock instead
 * of sleeping.
 */

/**
 * Bucket maps are pruned opportunistically once they grow past this many
 * entries — a cheap sweep rather than a timer, so idle IPs cannot grow the map
 * without bound.
 */
export const PRUNE_THRESHOLD = 5_000;

export const DEFAULT_WINDOW_MS = 60_000;
export const DEFAULT_MAX = 60;

/**
 * Create a fixed-window per-IP rate limiter.
 *
 * @param {object} [options]
 * @param {number} [options.windowMs] Window length in milliseconds.
 * @param {number} [options.max] Requests allowed per IP per window.
 * @param {() => number} [options.now] Clock returning epoch milliseconds;
 *   injectable so tests do not have to wait for a real window to expire.
 * @returns {import("express").RequestHandler & { buckets: Map<string, { count: number, resetAt: number }> }}
 *   Express middleware. Its `buckets` map is exposed for introspection in
 *   tests and diagnostics; treat it as read-only.
 */
export function createRateLimiter({
  windowMs = DEFAULT_WINDOW_MS,
  max = DEFAULT_MAX,
  now = Date.now,
} = {}) {
  const buckets = new Map(); // ip -> { count, resetAt }

  const middleware = (req, res, next) => {
    const key = req.ip || req.socket?.remoteAddress || "unknown";
    const current = now();
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= current) {
      bucket = { count: 0, resetAt: current + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    // Opportunistic cleanup so stale IPs don't grow the map unbounded.
    if (buckets.size > PRUNE_THRESHOLD) {
      for (const [k, b] of buckets) {
        if (b.resetAt <= current) buckets.delete(k);
      }
    }

    const ttlSeconds = Math.ceil((bucket.resetAt - current) / 1000);
    const remaining = Math.max(0, max - bucket.count);

    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(ttlSeconds));

    if (bucket.count > max) {
      res.setHeader("Retry-After", String(ttlSeconds));
      return res.status(429).json({
        error: "Too many requests",
        retryAfterMs: bucket.resetAt - current,
      });
    }

    next();
  };

  middleware.buckets = buckets;
  return middleware;
}
