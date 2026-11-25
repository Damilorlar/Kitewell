/**
 * Synchronous double-submit guard for form buttons.
 *
 * React state flips a button's `disabled` prop only after a re-render, which
 * leaves a gap where a second click starts a second wallet prompt. This guard
 * flips a ref-backed flag on the very first click, so the second click is
 * ignored before any await runs.
 */

export const DUPLICATE_SUBMIT_WINDOW_MS = 15000;

/**
 * @param {{ now?: () => number, duplicateWindowMs?: number }} [options]
 */
export function createSubmitGuard({
  now = () => Date.now(),
  duplicateWindowMs = DUPLICATE_SUBMIT_WINDOW_MS,
} = {}) {
  const inFlight = new Set();
  const lastSuccess = new Map();

  return {
    /**
     * Claim an in-flight slot for `key`.
     *
     * Returns `{ allowed: false }` when the same action is already running.
     * Otherwise returns `{ allowed: true, duplicate }`, where `duplicate` is
     * true when an identical fingerprint succeeded inside the window and the
     * caller should ask for an extra confirmation.
     */
    begin(key, fingerprint = "") {
      if (inFlight.has(key)) return { allowed: false, duplicate: false };
      inFlight.add(key);

      const previous = lastSuccess.get(key);
      const duplicate = Boolean(
        previous &&
          previous.fingerprint === fingerprint &&
          now() - previous.at < duplicateWindowMs
      );

      return { allowed: true, duplicate };
    },

    /** Record a completed submission so a quick repeat asks for confirmation. */
    succeed(key, fingerprint = "") {
      lastSuccess.set(key, { fingerprint, at: now() });
    },

    /** Release the in-flight slot; call from `finally` on success or failure. */
    end(key) {
      inFlight.delete(key);
    },

    isInFlight(key) {
      return inFlight.has(key);
    },

    /** Reset the guard when the account or the network changes. */
    reset() {
      inFlight.clear();
      lastSuccess.clear();
    },
  };
}
