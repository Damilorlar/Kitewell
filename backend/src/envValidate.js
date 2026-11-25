import {
  ENV_MISSING_ERROR,
  ENV_REQUIRED_ERROR,
  ENV_TYPE_ERROR,
} from "./envValidateConstants.js";

/**
 * Check that every required environment variable is present.
 *
 * A value counts as missing when it is absent, not a string, or blank after
 * trimming. Present values are returned trimmed. The input record is not
 * mutated. Invalid arguments return `{ ok: false }` and do not throw.
 *
 * This helper is standalone and is not wired into the HTTP app.
 *
 * @param {unknown} env Environment record, typically `process.env`.
 * @param {unknown} required Names that must be set.
 * @returns {{ ok: true, values: Record<string, string> } | { ok: false, error: string, missing: string[] }}
 */
export function validateEnv(env, required) {
  if (!isRecord(env)) {
    return { ok: false, error: ENV_TYPE_ERROR, missing: [] };
  }

  const names = normalizeRequired(required);
  if (!names.ok) {
    return { ok: false, error: names.error, missing: [] };
  }

  /** @type {Record<string, string>} */
  const values = {};
  /** @type {string[]} */
  const missing = [];

  for (const name of names.names) {
    const raw = env[name];
    if (typeof raw !== "string" || raw.trim() === "") {
      missing.push(name);
      continue;
    }
    values[name] = raw.trim();
  }

  if (missing.length > 0) {
    return {
      ok: false,
      error: `${ENV_MISSING_ERROR}: ${missing.join(", ")}`,
      missing,
    };
  }

  return { ok: true, values };
}

/**
 * Require every listed variable, or throw one error naming all of them.
 *
 * @param {unknown} env Environment record, typically `process.env`.
 * @param {unknown} required Names that must be set.
 * @returns {Record<string, string>} Trimmed values for the required names.
 */
export function assertEnv(env, required) {
  const result = validateEnv(env, required);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.values;
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {unknown} required
 * @returns {{ ok: true, names: string[] } | { ok: false, error: string }}
 */
function normalizeRequired(required) {
  if (!Array.isArray(required)) {
    return { ok: false, error: ENV_REQUIRED_ERROR };
  }

  /** @type {string[]} */
  const names = [];
  for (const name of required) {
    if (typeof name !== "string" || name.trim() === "") {
      return { ok: false, error: ENV_REQUIRED_ERROR };
    }
    const trimmed = name.trim();
    if (!names.includes(trimmed)) {
      names.push(trimmed);
    }
  }

  return { ok: true, names };
}
