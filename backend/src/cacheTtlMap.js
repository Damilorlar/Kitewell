/**
 * Create a small in-memory cache whose entries expire after a fixed TTL.
 * Expired entries are removed when their key is read; no timer is started.
 *
 * @param {object} options
 * @param {number} options.ttlMs Positive, finite lifetime in milliseconds.
 * @param {() => number} [options.now=Date.now] Clock returning finite epoch milliseconds.
 * @returns {{ get: (key: any) => any, set: (key: any, value: any) => void,
 *   has: (key: any) => boolean }} Cache with Map-style keys and values.
 * @throws {RangeError} If the TTL or a clock reading is not finite and valid.
 * @throws {TypeError} If `now` is not a function.
 */
export function createCacheTtlMap({ ttlMs, now = Date.now } = {}) {
  if (typeof ttlMs !== "number" || !Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new RangeError("ttlMs must be a positive finite number");
  }
  if (typeof now !== "function") {
    throw new TypeError("now must be a function");
  }

  const entries = new Map();

  function currentTime() {
    const time = now();
    if (typeof time !== "number" || !Number.isFinite(time)) {
      throw new RangeError("now must return a finite number");
    }
    return time;
  }

  function liveEntry(key) {
    const entry = entries.get(key);
    if (entry === undefined) return undefined;
    if (entry.expiresAt <= currentTime()) {
      entries.delete(key);
      return undefined;
    }
    return entry;
  }

  return {
    /** Return the cached value, or undefined when missing or expired. */
    get(key) {
      return liveEntry(key)?.value;
    },
    /** Store a value and start (or restart) its TTL from the current time. */
    set(key, value) {
      const expiresAt = currentTime() + ttlMs;
      if (!Number.isFinite(expiresAt)) {
        throw new RangeError("expiry must be finite");
      }
      entries.set(key, { value, expiresAt });
    },
    /** Report whether a key has a live entry, including one holding undefined. */
    has(key) {
      return liveEntry(key) !== undefined;
    },
  };
}
