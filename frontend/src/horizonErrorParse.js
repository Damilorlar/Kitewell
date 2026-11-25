/**
 * Horizon error response parser.
 *
 * Maps a raw Horizon error response body to a short, human-readable reason
 * plus the raw result codes array. Horizon error responses (from failed
 * transactions) include `extras.result_codes` (transaction-level) and
 * `extras.result_codes.operations` (per-operation result codes).
 *
 * This module is pure/standalone — no network calls, no side effects.
 *
 * @module horizonErrorParse
 */

/**
 * Result of parsing a Horizon error response.
 * @typedef {Object} HorizonErrorParseResult
 * @property {string} reason - Short human-readable reason for the error.
 * @property {string[]} resultCodes - Raw result codes from `extras.result_codes` (transaction + operations).
 * @property {string} errorType - The Horizon error type URL (e.g., "https://stellar.org/horizon-errors/transaction_failed").
 * @property {number} status - HTTP status code.
 */

/**
 * Map of well-known Horizon operation result codes to human-readable reasons.
 * These are the most common operation result codes from Stellar Core.
 * @type {Object.<string, string>}
 */
const OPERATION_RESULT_CODE_MESSAGES = {
  // Payment operation codes
  op_no_issuer: "Asset issuer does not exist.",
  op_no_trust: "Destination account does not trust the asset (missing trustline).",
  op_not_authorized: "Destination account is not authorized to hold the asset.",
  op_line_full: "Destination account trustline limit would be exceeded.",
  op_underfunded: "Sending account does not have enough balance.",
  op_src_no_trust: "Sending account does not trust the asset (missing trustline).",
  op_src_not_authorized: "Sending account is not authorized to hold the asset.",

  // Path payment codes
  op_no_path: "No path found between source and destination assets.",
  op_too_few_offers: "Insufficient liquidity on the order book for the path.",
  op_offer_cross_self: "Path would cross an offer from the same account.",
  op_over_sendmax: "Strict receive path would exceed sendMax.",
  op_under_destmin: "Strict send path would receive less than destMin.",

  // Change trust codes
  op_low_reserve: "Account does not have enough reserve for a new trustline.",
  op_invalid_limit: "Trustline limit is invalid.",
  op_trust_not_allowed: "Asset does not allow trustlines (auth_required not set).",

  // Manage offer codes
  op_sell_no_issuer: "Selling asset issuer does not exist.",
  op_buy_no_issuer: "Buying asset issuer does not exist.",
  op_sell_not_authorized: "Account not authorized to sell the asset.",
  op_buy_not_authorized: "Account not authorized to buy the asset.",

  // Create account codes
  op_already_exist: "Destination account already exists.",

  // General transaction codes (as operations)
  tx_insufficient_balance: "Account has insufficient balance for the operation.",
  tx_no_trust: "Missing required trustline.",
  tx_too_few_offers: "Insufficient order book liquidity.",
};

/**
 * Map of transaction-level result codes to human-readable reasons.
 * @type {Object.<string, string>}
 */
const TRANSACTION_RESULT_CODE_MESSAGES = {
  tx_bad_seq: "Transaction sequence number is invalid (too low or too high).",
  tx_bad_auth: "Transaction authorization failed (missing or invalid signatures).",
  tx_insufficient_fee: "Transaction fee is below the network minimum.",
  tx_failed: "Transaction failed during execution.",
  tx_internal_error: "Internal server error processing transaction.",
  tx_too_early: "Transaction timebounds not yet reached.",
  tx_too_late: "Transaction timebounds expired.",
  tx_missing_operation: "Transaction has no operations.",
  tx_bad_auth_extra: "Transaction has extra unauthorized signatures.",
  tx_insufficient_balance: "Account has insufficient balance for fee or operations.",
  tx_no_account: "Source account does not exist.",
  tx_insufficient_reserve: "Account reserve insufficient for transaction.",
};

/**
 * Parse a Horizon error response body into a human-readable reason and result codes.
 *
 * @param {Object} errorResponse - The raw Horizon error response body (parsed JSON).
 * @returns {HorizonErrorParseResult} Parsed error with reason, result codes, error type, and status.
 *
 * @throws {Error} If errorResponse is null, undefined, not an object, or is an array.
 *
 * @example
 * // Typical transaction_failed response
 * parseHorizonError({
 *   type: "https://stellar.org/horizon-errors/transaction_failed",
 *   title: "Transaction Failed",
 *   status: 400,
 *   detail: "The transaction failed when submitted to the stellar network.",
 *   extras: {
 *     result_codes: { transaction: "tx_failed", operations: ["op_underfunded"] },
 *     envelope_xdr: "...",
 *     result_xdr: "..."
 *   }
 * });
 * // => {
 * //   reason: "Sending account does not have enough balance.",
 * //   resultCodes: ["tx_failed", "op_underfunded"],
 * //   errorType: "https://stellar.org/horizon-errors/transaction_failed",
 * //   status: 400
 * // }
 *
 * @example
 * // Missing extras.result_codes
 * parseHorizonError({
 *   type: "https://stellar.org/horizon-errors/transaction_failed",
 *   status: 400
 * });
 * // => {
 * //   reason: "Transaction failed (no result codes available).",
 * //   resultCodes: [],
 * //   errorType: "https://stellar.org/horizon-errors/transaction_failed",
 * //   status: 400
 * // }
 */
export function parseHorizonError(errorResponse) {
  if (!errorResponse || typeof errorResponse !== "object" || Array.isArray(errorResponse)) {
    throw new Error("Horizon error response is required and must be an object.");
  }

  const { type = "", title = "", status = 0, detail = "", extras = {} } = errorResponse;
  const { result_codes = {} } = extras;

  // Extract all result codes: transaction + operations
  const transactionCode = result_codes.transaction;
  const operationCodes = Array.isArray(result_codes.operations) ? result_codes.operations : [];
  const allCodes = [transactionCode, ...operationCodes].filter(Boolean);

  // Build human-readable reason
  let reason = "";

  // Check operation codes first (more specific)
  for (const code of operationCodes) {
    if (OPERATION_RESULT_CODE_MESSAGES[code]) {
      reason = OPERATION_RESULT_CODE_MESSAGES[code];
      break;
    }
  }

  // Fall back to transaction code
  if (!reason && transactionCode && TRANSACTION_RESULT_CODE_MESSAGES[transactionCode]) {
    reason = TRANSACTION_RESULT_CODE_MESSAGES[transactionCode];
  }

  // Fall back to title/detail
  if (!reason) {
    if (detail) {
      reason = detail;
    } else if (title) {
      reason = title;
    } else {
      reason = "Transaction failed (unknown reason).";
    }
  }

  return {
    reason,
    resultCodes: allCodes,
    errorType: type,
    status,
  };
}

/**
 * Check if an error response is a Horizon transaction_failed error.
 *
 * @param {Object} errorResponse - The raw Horizon error response body.
 * @returns {boolean} True if the error is a transaction_failed type.
 */
export function isTransactionFailedError(errorResponse) {
  if (!errorResponse || typeof errorResponse !== "object" || Array.isArray(errorResponse)) return false;
  return errorResponse.type === "https://stellar.org/horizon-errors/transaction_failed";
}

/**
 * Extract just the operation result codes from a Horizon error response.
 *
 * @param {Object} errorResponse - The raw Horizon error response body.
 * @returns {string[]} Array of operation result codes (empty if none).
 */
export function getOperationResultCodes(errorResponse) {
  if (!errorResponse || typeof errorResponse !== "object" || Array.isArray(errorResponse)) return [];
  const { extras = {} } = errorResponse;
  const { result_codes = {} } = extras;
  return Array.isArray(result_codes.operations) ? result_codes.operations : [];
}

/**
 * Extract the transaction result code from a Horizon error response.
 *
 * @param {Object} errorResponse - The raw Horizon error response body.
 * @returns {string|null} Transaction result code or null if not present.
 */
export function getTransactionResultCode(errorResponse) {
  if (!errorResponse || typeof errorResponse !== "object" || Array.isArray(errorResponse)) return null;
  const { extras = {} } = errorResponse;
  const { result_codes = {} } = extras;
  return result_codes.transaction || null;
}

/**
 * Extract failed operation results with their zero-based operation indexes.
 *
 * Accepts both a Horizon submit error (`extras.result_codes`) and a transaction
 * record that exposes `result_codes` directly. Successful and unattempted
 * operations are omitted so later operation indexes remain accurate.
 */
export function parseTransactionFailure(errorResponse) {
  if (!errorResponse || typeof errorResponse !== "object" || Array.isArray(errorResponse)) {
    return null;
  }

  const resultCodes =
    errorResponse.extras?.result_codes ?? errorResponse.result_codes;
  if (!resultCodes || typeof resultCodes !== "object") return null;

  const operationResults = Array.isArray(resultCodes.operations)
    ? resultCodes.operations
    : [];
  const operations = operationResults.flatMap((code, index) => {
    if (
      typeof code !== "string" ||
      !code ||
      code === "op_success" ||
      code === "op_not_attempted"
    ) {
      return [];
    }

    return [
      {
        index,
        code,
        explanation: Object.prototype.hasOwnProperty.call(
          OPERATION_RESULT_CODE_MESSAGES,
          code
        )
          ? OPERATION_RESULT_CODE_MESSAGES[code]
          : null,
      },
    ];
  });
  const transactionCode =
    typeof resultCodes.transaction === "string" && resultCodes.transaction
      ? resultCodes.transaction
      : null;
  const transactionExplanation =
    transactionCode &&
    Object.prototype.hasOwnProperty.call(
      TRANSACTION_RESULT_CODE_MESSAGES,
      transactionCode
    )
      ? TRANSACTION_RESULT_CODE_MESSAGES[transactionCode]
      : null;

  return {
    operations,
    transactionCode,
    transactionExplanation,
  };
}

/** Parse a Horizon SDK error or transaction response without exposing XDR. */
export function getTransactionFailure(errorOrResponse) {
  const responseBody =
    errorOrResponse?.response?.data ??
    errorOrResponse?.response?.body ??
    errorOrResponse?.data ??
    errorOrResponse;
  return parseTransactionFailure(responseBody);
}