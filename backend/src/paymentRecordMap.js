/**
 * Payment record mapper.
 *
 * Maps raw Horizon payment operation records into the simplified payment shape
 * returned by `GET /api/payments/:address` and consumed by the frontend:
 *
 * ```js
 * {
 *   id, from, to, amount, asset_type, asset_code,
 *   transaction_hash, created_at, explorerUrl
 * }
 * ```
 *
 * This module is standalone: it is not wired into `app.js`, `index.js`, or any
 * route yet, and it has no Horizon client or Express dependency, so it can be
 * unit-tested with plain fixtures.
 */

/** Explorer base used when the caller does not supply one. */
export const DEFAULT_EXPLORER_BASE = "https://stellar.expert/explorer/testnet";

/** Fields a payment record must carry as non-blank strings. */
const REQUIRED_STRING_FIELDS = [
  "id",
  "from",
  "to",
  "amount",
  "transaction_hash",
];

/** Trim a base URL and drop trailing slashes so `/tx/<hash>` never doubles up. */
function normalizeExplorerBase(explorerBase) {
  const value =
    typeof explorerBase === "string" ? explorerBase.trim() : DEFAULT_EXPLORER_BASE;

  return (value || DEFAULT_EXPLORER_BASE).replace(/\/+$/, "");
}

/**
 * Map one Horizon payment operation record.
 *
 * Native payments default `asset_code` to `XLM`; a missing `created_at`
 * becomes `null`. Horizon hands `amount` over as a decimal string with seven
 * decimals, which is preserved verbatim so no precision is lost.
 *
 * @param {object} record Horizon payment operation (`type: "payment"`).
 * @param {object} [options]
 * @param {string} [options.explorerBase=DEFAULT_EXPLORER_BASE] explorer base
 *   used to build `explorerUrl`
 * @returns {object} simplified payment record
 * @throws {TypeError} when the record is not an object, is not a payment
 *   operation, or is missing a required string field
 */
export function mapPaymentRecord(record, options = {}) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new TypeError("Payment record must be an object.");
  }

  if (record.type && record.type !== "payment") {
    throw new TypeError(`Unsupported operation type: ${record.type}.`);
  }

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof record[field] !== "string" || !record[field].trim()) {
      throw new TypeError(`Payment record is missing "${field}".`);
    }
  }

  const { explorerBase = DEFAULT_EXPLORER_BASE } = options ?? {};
  const base = normalizeExplorerBase(explorerBase);

  return {
    id: record.id,
    from: record.from,
    to: record.to,
    amount: record.amount,
    asset_type: record.asset_type ?? "native",
    asset_code: record.asset_code || "XLM",
    transaction_hash: record.transaction_hash,
    created_at: record.created_at ?? null,
    explorerUrl: `${base}/tx/${record.transaction_hash}`,
  };
}

/**
 * Map a list of Horizon operation records, dropping non-payment operations
 * (for example `create_account`) while preserving order.
 *
 * Non-array input yields an empty array, matching `mapBalances`. A payment
 * record that is malformed still throws, so data problems are not hidden.
 *
 * @param {object[]} records Horizon operation records.
 * @param {object} [options] forwarded to {@link mapPaymentRecord}.
 * @returns {object[]} simplified payment records.
 */
export function mapPaymentRecords(records, options = {}) {
  if (!Array.isArray(records)) return [];

  return records
    .filter(
      (record) =>
        record &&
        typeof record === "object" &&
        !Array.isArray(record) &&
        (record.type ?? "payment") === "payment",
    )
    .map((record) => mapPaymentRecord(record, options));
}
