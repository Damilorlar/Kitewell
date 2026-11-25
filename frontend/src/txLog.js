/**
 * In-memory log of the transactions this browser session submitted.
 *
 * Nothing is persisted: a reload starts with an empty list, and disconnecting
 * clears it. Only successful submissions are recorded by callers.
 */

export const TX_LOG_FILENAME = "kitewell-session-transactions.json";

/**
 * Create a session transaction log.
 *
 * @param {{ now?: () => Date }} [options] Clock override for deterministic tests.
 */
export function createTxLog({ now = () => new Date() } = {}) {
  const entries = [];

  /**
   * Append one successful submission. A repeated hash is stored once.
   *
   * @param {{ hash: string, operationType: string, network: string, time?: Date|string }} entry
   */
  function record({ hash, operationType, network, time } = {}) {
    if (!hash) return;
    if (entries.some((existing) => existing.hash === hash)) return;

    const submittedAt = time ? new Date(time) : now();
    entries.push({
      hash,
      operationType: operationType || "unknown",
      network: network || "unknown",
      time: submittedAt.toISOString(),
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

/** Download a log as a JSON file. Browser-only; callers gate on a connected wallet. */
export function downloadTxLog(log, filename = TX_LOG_FILENAME) {
  const blob = new Blob([log.toJSON()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
