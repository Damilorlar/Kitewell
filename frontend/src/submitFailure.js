import { parseHorizonError } from "./horizonErrorParse";

/** Freighter user declined / closed the sign prompt. */
export const FREIGHTER_CANCELLED_CODE = "FREIGHTER_CANCELLED";

/** Horizon rejected the signed envelope. */
export const HORIZON_FAILURE_CODE = "HORIZON_FAILURE";

/** Result sentence stored for a cancelled Freighter prompt. */
export const CANCELLED_RESULT = "cancelled";

/**
 * Build an Error tagged as a Freighter cancellation.
 * Toast can still show `message`; the failed list records `cancelled`.
 */
export function freighterCancelledError(message) {
  const error = new Error(
    message || "Transaction signing was rejected in Freighter."
  );
  error.code = FREIGHTER_CANCELLED_CODE;
  return error;
}

/**
 * Build an Error tagged as a Horizon submit failure with a result sentence.
 */
export function horizonFailureError(resultSentence, cause) {
  const error = new Error(resultSentence || "Transaction failed.");
  error.code = HORIZON_FAILURE_CODE;
  if (cause) error.cause = cause;
  return error;
}

/**
 * Result sentence for the failed-submit list.
 * Cancelled Freighter prompts become `cancelled`, not a Horizon reason.
 */
export function submitFailureResult(error) {
  if (!error) return "Submit failed.";
  if (error.code === FREIGHTER_CANCELLED_CODE) return CANCELLED_RESULT;
  if (error.code === HORIZON_FAILURE_CODE && error.message) {
    const operationExplanation = error.transactionFailure?.operations?.find(
      (operation) => operation.explanation
    )?.explanation;
    if (operationExplanation) return operationExplanation;
    if (error.transactionFailure?.transactionExplanation) {
      return error.transactionFailure.transactionExplanation;
    }
    return error.message;
  }

  const body = error.response?.data;
  if (body && typeof body === "object") {
    try {
      return parseHorizonError(body).reason;
    } catch {
      /* fall through */
    }
  }

  return error.message || "Submit failed.";
}
