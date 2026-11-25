/**
 * Error raised when pagination query parameters or parser options are invalid.
 *
 * `code` is a stable machine-readable identifier. Callers should branch on
 * `code`, not on the message text.
 */
export class PaginationError extends Error {
  /**
   * @param {string} code Machine-readable error code.
   * @param {string} message Human-readable explanation.
   */
  constructor(code, message) {
    super(message);
    this.name = "PaginationError";
    this.code = code;
  }
}
