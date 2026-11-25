/**
 * In-memory log of failed submits for this browser session.
 *
 * Nothing is persisted (no localStorage): a reload starts empty, and
 * disconnecting clears it. Callers record only failures — successes stay out.
 */

export const FAILED_SUBMIT_LOG_FILENAME = "kitewell-session-failed-submits.json";

/**
 * Create a session failed-submit log.
 *
 * @param {{ now?: () => Date }} [options] Clock override for deterministic tests.
 */
export function createFailedSubmitLog({ now = () => new Date() } = {}) {
  const entries = [];

  /**
   * Append one failed submission.
   *
   * @param {{
   *   operationType: string,
   *   network: string,
   *   result: string,
   *   time?: Date|string
   * }} entry
   */
  function record({ operationType, network, result, time } = {}) {
    if (!result) return;

    const failedAt = time ? new Date(time) : now();
    entries.push({
      time: failedAt.toISOString(),
      operationType: operationType || "unknown",
      network: network || "unknown",
      result: String(result),
    });
  }

  function list() {
    return entries.map((entry) => ({ ...entry }));
  }

  function clear() {
    entries.length = 0;
  }

  function toJSON() {
    return JSON.stringify(entries, null, 2);
  }

  return { record, list, clear, toJSON };
}

/** Download the failed list as JSON. Browser-only. */
export function downloadFailedSubmitLog(
  log,
  filename = FAILED_SUBMIT_LOG_FILENAME
) {
  const blob = new Blob([log.toJSON()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
