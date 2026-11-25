import {
  DEFAULT_SENSITIVE_FIELDS,
  LOG_FIELDS_ERROR,
  LOG_RECORD_ERROR,
  REDACTED,
} from "./logRedactConstants.js";

/**
 * Copy a query or body record with sensitive field names replaced.
 *
 * Matching is case-insensitive and ignores `_` and `-`, so `api_key` matches
 * `apiKey`. Nested plain objects are redacted one level down. Arrays, `null`,
 * and other non-objects are rejected. The input is not mutated, and invalid
 * input does not throw.
 *
 * This helper is standalone and is not wired into the HTTP app.
 *
 * @param {unknown} record Query, body, or log fields.
 * @param {readonly string[]} [fields] Names to redact. Defaults to the built-in list.
 * @returns {{ ok: true, value: Record<string, unknown> } | { ok: false, error: string }}
 */
export function redactFields(record, fields = DEFAULT_SENSITIVE_FIELDS) {
  if (!isPlainObject(record)) {
    return { ok: false, error: LOG_RECORD_ERROR };
  }

  const names = normalizeFields(fields);
  if (!names.ok) {
    return { ok: false, error: names.error };
  }

  return { ok: true, value: redactObject(record, names.names, 0) };
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {unknown} fields
 * @returns {{ ok: true, names: Set<string> } | { ok: false, error: string }}
 */
function normalizeFields(fields) {
  if (!Array.isArray(fields)) {
    return { ok: false, error: LOG_FIELDS_ERROR };
  }

  /** @type {Set<string>} */
  const names = new Set();
  for (const field of fields) {
    if (typeof field !== "string" || field.trim() === "") {
      return { ok: false, error: LOG_FIELDS_ERROR };
    }
    names.add(normalizeName(field));
  }
  return { ok: true, names };
}

/**
 * @param {string} name
 * @returns {string}
 */
function normalizeName(name) {
  return name.trim().toLowerCase().replace(/[_-]/g, "");
}

/**
 * @param {Record<string, unknown>} record
 * @param {Set<string>} names
 * @param {number} depth
 * @returns {Record<string, unknown>}
 */
function redactObject(record, names, depth) {
  /** @type {Record<string, unknown>} */
  const copy = {};
  for (const [key, value] of Object.entries(record)) {
    if (names.has(normalizeName(key))) {
      copy[key] = REDACTED;
      continue;
    }
    if (depth === 0 && isPlainObject(value)) {
      copy[key] = redactObject(value, names, depth + 1);
      continue;
    }
    copy[key] = value;
  }
  return copy;
}
