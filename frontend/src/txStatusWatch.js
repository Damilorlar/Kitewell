import * as StellarSdk from "@stellar/stellar-sdk";
import { getActiveNetwork, getActiveNetworkId } from "./network";
import { buildTransactionExplorerUrl } from "./explorerLink";

/**
 * Follow a submitted transaction until the network settles it.
 *
 * The lab shows a hash right after submit, which says nothing about whether the
 * transaction landed. This module polls Horizon for that hash and reports
 * `pending`, `success`, `failed` or `expired`, so a queued transaction never
 * looks like a failed one. The Horizon read, the clock and the timer are
 * injected, which keeps the polling rules testable in the Node environment and
 * lets the same watch serve a submitted transaction and a pasted hash.
 */

const TRANSACTION_HASH = /^[0-9a-fA-F]{64}$/;

/** The states the watch can report, in the order a transaction moves through them. */
export const TX_STATUSES = Object.freeze(["pending", "success", "failed", "expired"]);

/** How long to wait between Horizon reads. */
export const TX_POLL_INTERVAL_MS = 2000;

/**
 * How long to keep looking when the envelope's max time is unknown: the lab
 * builds every transaction with a 180 second timeout, so a watch that cannot
 * read a max time still stops on the same horizon.
 */
export const TX_WATCH_WINDOW_MS = 180000;

/**
 * Validate a transaction hash and put it in the lowercase form Horizon and the
 * explorers use.
 *
 * @param {string} hash 64 hexadecimal characters, any case.
 * @returns {string} The lowercase hash.
 */
export function normaliseTxHash(hash) {
  const trimmed = typeof hash === "string" ? hash.trim() : "";
  if (!TRANSACTION_HASH.test(trimmed)) {
    throw new Error("Transaction hash must be 64 hexadecimal characters.");
  }
  return trimmed.toLowerCase();
}

function secondsToMillis(value) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}

/**
 * The absolute time a signed envelope stops being valid, from its timebounds.
 *
 * @param {string} envelopeXdr Signed (or fee-bumped) transaction envelope.
 * @param {object} [options]
 * @param {string} [options.networkPassphrase] Passphrase the envelope was built on.
 * @returns {number|null} Deadline in milliseconds, or null when the envelope has
 *   no max time (TimeoutInfinite).
 */
export function deadlineFromEnvelope(envelopeXdr, { networkPassphrase = getActiveNetwork().passphrase } = {}) {
  let transaction;
  try {
    transaction = StellarSdk.TransactionBuilder.fromXDR(envelopeXdr, networkPassphrase);
  } catch {
    throw new Error("The transaction envelope could not be read.");
  }
  // A fee bump carries its timeout on the transaction inside it.
  const timeBounds = transaction.timeBounds ?? transaction.innerTransaction?.timeBounds;
  return secondsToMillis(timeBounds?.maxTime);
}

/**
 * Read one Horizon transaction record into the states the watch reports.
 *
 * @param {object} record Horizon transaction resource.
 * @returns {{ status: "success"|"failed", code: string|null, operationCodes: string[] }}
 */
export function txStatusFromRecord(record) {
  const codes = record?.result_codes ?? {};
  return {
    status: record?.successful === true ? "success" : "failed",
    code: codes.transaction ?? null,
    operationCodes: Array.isArray(codes.operations) ? codes.operations : [],
  };
}

function isMissing(error) {
  return error instanceof StellarSdk.NotFoundError || error?.response?.status === 404;
}

/** One readable clause out of whatever Horizon or a transport threw. */
function reason(error) {
  const text = String(error?.message ?? error ?? "")
    .split("\n")[0]
    .trim()
    .replace(/\.+$/, "");
  return text || "Horizon did not answer";
}

function readServer() {
  return new StellarSdk.Horizon.Server(getActiveNetwork().horizonUrl);
}

function resolveDeadlineMs({ deadlineMs, envelopeXdr, windowMs, nowMs, networkPassphrase }) {
  if (deadlineMs !== undefined && deadlineMs !== null) return Number(deadlineMs);
  if (envelopeXdr) {
    const fromEnvelope = deadlineFromEnvelope(envelopeXdr, { networkPassphrase });
    if (fromEnvelope !== null) return fromEnvelope;
  }
  return nowMs() + Number(windowMs);
}

/**
 * Poll Horizon for one transaction until it settles.
 *
 * @param {object} options
 * @param {string} options.hash Transaction to follow.
 * @param {(hash: string) => Promise<object>} [options.loadTransaction] Horizon read.
 * @param {number} [options.deadlineMs] Absolute stop time; wins over `envelopeXdr`.
 * @param {string} [options.envelopeXdr] Envelope to read the max time from.
 * @param {number} [options.windowMs] Watch length when no max time is known.
 * @param {number} [options.intervalMs] Delay between reads.
 * @param {() => number} [options.nowMs] Clock.
 * @param {(ms: number) => Promise<void>} [options.sleep] Timer.
 * @param {string} [options.networkPassphrase] Passphrase for `envelopeXdr`.
 * @param {string} [options.networkId] Network the explorer link points at.
 * @param {(hash: string) => string} [options.explorerUrlFor] Explorer link builder.
 * @param {(snapshot: object) => void} [options.onUpdate] Called per read.
 * @returns {Promise<{ hash: string, status: string, code: string|null,
 *   operationCodes: string[], attempts: number, explorerUrl: string }>}
 */
export async function watchTransactionStatus({
  hash,
  loadTransaction = (value) => readServer().transactions().transaction(value).call(),
  deadlineMs = null,
  envelopeXdr = null,
  windowMs = TX_WATCH_WINDOW_MS,
  intervalMs = TX_POLL_INTERVAL_MS,
  nowMs = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  networkPassphrase = getActiveNetwork().passphrase,
  networkId = getActiveNetworkId(),
  explorerUrlFor = (value) => buildTransactionExplorerUrl(networkId, value),
  onUpdate,
} = {}) {
  const txHash = normaliseTxHash(hash);
  const deadline = resolveDeadlineMs({
    deadlineMs,
    envelopeXdr,
    windowMs,
    nowMs,
    networkPassphrase,
  });
  if (!Number.isFinite(deadline) || deadline <= 0) {
    throw new Error("The transaction watch needs a deadline in milliseconds.");
  }
  const explorerUrl = explorerUrlFor(txHash);

  let attempts = 0;
  for (;;) {
    attempts += 1;
    let record = null;
    try {
      record = await loadTransaction(txHash);
    } catch (error) {
      if (!isMissing(error)) {
        throw new Error(
          `The transaction watch could not read the transaction: ${reason(error)}.`,
          { cause: error }
        );
      }
    }

    let snapshot;
    if (record) {
      snapshot = { hash: txHash, explorerUrl, attempts, ...txStatusFromRecord(record) };
    } else if (nowMs() >= deadline) {
      snapshot = {
        hash: txHash,
        explorerUrl,
        attempts,
        status: "expired",
        code: null,
        operationCodes: [],
      };
    } else {
      snapshot = {
        hash: txHash,
        explorerUrl,
        attempts,
        status: "pending",
        code: null,
        operationCodes: [],
      };
    }
    onUpdate?.(snapshot);
    // Success, a failed result and the passed max time all end the watch; only a
    // transaction nobody has heard of yet keeps it running.
    if (snapshot.status !== "pending") return snapshot;
    await sleep(intervalMs);
  }
}

/**
 * The line the lab shows for one snapshot, with the explorer link beside it.
 *
 * @param {object} snapshot Snapshot from {@link watchTransactionStatus}.
 * @returns {{ status: string, text: string, explorerUrl: string }}
 */
export function txStatusPresentation(snapshot) {
  const { status, code, operationCodes, explorerUrl } = snapshot ?? {};
  if (!TX_STATUSES.includes(status)) {
    throw new Error(`Unknown transaction status: ${status}`);
  }

  const detail =
    status === "failed"
      ? [code, operationCodes?.[0]].filter(Boolean).join(" / ")
      : null;

  const texts = {
    pending: "Waiting for the network to confirm this transaction.",
    success: "The transaction is on the ledger.",
    failed: detail ? `The transaction failed: ${detail}.` : "The transaction failed.",
    expired:
      "Nothing reached the ledger before the transaction's max time, so it never landed.",
  };

  return { status, text: texts[status], explorerUrl };
}
