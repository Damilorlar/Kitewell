/**
 * Build the JSON body for a backend error response.
 *
 * String inputs are trimmed. Missing or whitespace-only values use safe
 * defaults; other input types are rejected instead of being stringified.
 *
 * @param {string} [code="UNKNOWN_ERROR"] Machine-readable error code.
 * @param {string} [message="An unexpected error occurred."] Public message.
 * @returns {{ error: { code: string, message: string } }} Error response body.
 * @throws {TypeError} If a supplied value is not a string.
 */
export function formatErrorResponse(code, message) {
  if (code !== undefined && typeof code !== "string") {
    throw new TypeError("code must be a string");
  }
  if (message !== undefined && typeof message !== "string") {
    throw new TypeError("message must be a string");
  }

  return {
    error: {
      code: code?.trim() || "UNKNOWN_ERROR",
      message: message?.trim() || "An unexpected error occurred.",
    },
  };
}
