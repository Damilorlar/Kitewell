/**
 * Thrown when `requestTimeout` is configured with a timeout that cannot be armed.
 * The factory raises this before it returns middleware, so no timer is started.
 */
export class RequestTimeoutError extends Error {
  /**
   * @param {string} message Human-readable explanation of the rejected timeout.
   * @param {object} [details]
   * @param {unknown} [details.timeoutMs] Value that failed validation.
   * @param {"invalid-type"|"non-finite"|"non-integer"|"non-positive"} [details.reason]
   *   Machine-readable cause. `invalid-type` means the value is not a number;
   *   the other reasons match the numeric checks in order.
   */
  constructor(message, details = {}) {
    super(message);
    this.name = "RequestTimeoutError";
    this.timeoutMs = details.timeoutMs;
    this.reason = details.reason;
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, RequestTimeoutError);
    }
  }
}
