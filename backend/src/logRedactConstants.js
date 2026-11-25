/** Replacement written in place of a sensitive field value. */
export const REDACTED = "[redacted]";

/** Shown when the record is not a plain object. */
export const LOG_RECORD_ERROR = "Log record must be a plain object";

/** Shown when the sensitive-name list is unusable. */
export const LOG_FIELDS_ERROR = "Sensitive field names must be an array of non-empty strings";

/**
 * Default query and body names removed from a structured log line.
 * Matching ignores case and `_` / `-` separators.
 */
export const DEFAULT_SENSITIVE_FIELDS = Object.freeze([
  "password",
  "secret",
  "token",
  "authorization",
  "apiKey",
  "seed",
  "privateKey",
]);
