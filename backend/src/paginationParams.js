import { PaginationError } from "./paginationParamsErrors.js";

/** Inclusive bounds and fallback used when the caller omits options. */
export const PAGINATION_DEFAULTS = Object.freeze({
  minLimit: 1,
  maxLimit: 200,
  defaultLimit: 20,
});

/** Maximum accepted length of a trimmed cursor string. */
export const MAX_CURSOR_LENGTH = 256;

/**
 * Parse and validate `limit` and `cursor` query parameters.
 *
 * `limit` must be an integer inside `[minLimit, maxLimit]`. A missing limit
 * falls back to `defaultLimit`. `cursor` is optional: a missing or blank
 * value becomes `null`, and a non-blank value is returned trimmed when its
 * length is between 1 and 256 characters.
 *
 * This helper does not read the request or talk to a route. Pass the query
 * object you already have (for example `req.query`).
 *
 * @param {Record<string, unknown> | null | undefined} query Query bag. `null`
 *   and `undefined` are treated as an empty query.
 * @param {object} [options]
 * @param {number} [options.minLimit] Inclusive lower bound. Default `1`.
 * @param {number} [options.maxLimit] Inclusive upper bound. Default `200`.
 * @param {number} [options.defaultLimit] Used when `limit` is missing.
 *   Default `20`. Must lie inside `[minLimit, maxLimit]`.
 * @returns {{ limit: number, cursor: string | null }}
 * @throws {PaginationError} `invalid_query` when `query` is not an object.
 * @throws {PaginationError} `invalid_options` when bounds are not safe
 *   integers, `minLimit` is greater than `maxLimit`, or `defaultLimit` sits
 *   outside that range.
 * @throws {PaginationError} `invalid_limit` when `limit` is present but not
 *   an integer.
 * @throws {PaginationError} `limit_out_of_range` when `limit` is an integer
 *   outside `[minLimit, maxLimit]`.
 * @throws {PaginationError} `invalid_cursor` when `cursor` is not a string or
 *   is longer than 256 characters after trimming.
 */
export function parsePaginationParams(query, options) {
  const bounds = resolveOptions(options);
  const source = normalizeQuery(query);

  return {
    limit: parseLimit(source.limit, bounds),
    cursor: parseCursor(source.cursor),
  };
}

/**
 * @param {unknown} query
 * @returns {Record<string, unknown>}
 */
function normalizeQuery(query) {
  if (query == null) return {};
  if (typeof query !== "object" || Array.isArray(query)) {
    throw new PaginationError("invalid_query", "query must be an object");
  }
  return query;
}

/**
 * Merge caller overrides with {@link PAGINATION_DEFAULTS} and reject a
 * configuration that cannot be applied safely.
 *
 * @param {unknown} options
 * @returns {{ minLimit: number, maxLimit: number, defaultLimit: number }}
 */
function resolveOptions(options) {
  if (options == null) {
    return { ...PAGINATION_DEFAULTS };
  }
  if (typeof options !== "object" || Array.isArray(options)) {
    throw new PaginationError("invalid_options", "options must be an object");
  }

  const minLimit = options.minLimit ?? PAGINATION_DEFAULTS.minLimit;
  const maxLimit = options.maxLimit ?? PAGINATION_DEFAULTS.maxLimit;
  const defaultLimit = options.defaultLimit ?? PAGINATION_DEFAULTS.defaultLimit;

  assertSafeInteger("minLimit", minLimit);
  assertSafeInteger("maxLimit", maxLimit);
  assertSafeInteger("defaultLimit", defaultLimit);

  if (minLimit > maxLimit) {
    throw new PaginationError(
      "invalid_options",
      "minLimit cannot be greater than maxLimit",
    );
  }
  if (defaultLimit < minLimit || defaultLimit > maxLimit) {
    throw new PaginationError(
      "invalid_options",
      "defaultLimit must be within minLimit and maxLimit",
    );
  }

  return { minLimit, maxLimit, defaultLimit };
}

/**
 * @param {string} name
 * @param {unknown} value
 */
function assertSafeInteger(name, value) {
  if (!Number.isSafeInteger(value)) {
    throw new PaginationError(
      "invalid_options",
      `${name} must be a safe integer`,
    );
  }
}

/**
 * @param {unknown} raw
 * @param {{ minLimit: number, maxLimit: number, defaultLimit: number }} bounds
 * @returns {number}
 */
function parseLimit(raw, bounds) {
  if (raw === undefined || raw === null) {
    return bounds.defaultLimit;
  }

  const value = coerceInteger(raw);
  if (value === null) {
    throw new PaginationError("invalid_limit", "limit must be an integer");
  }
  if (value < bounds.minLimit || value > bounds.maxLimit) {
    throw new PaginationError(
      "limit_out_of_range",
      `limit must be between ${bounds.minLimit} and ${bounds.maxLimit}`,
    );
  }
  return value;
}

/**
 * Accept a safe integer or a base-10 integer string. Anything else, including
 * decimals and scientific notation, is rejected so `"20.0"` and `"1e2"` do
 * not silently change the page size.
 *
 * @param {unknown} raw
 * @returns {number | null}
 */
function coerceInteger(raw) {
  if (typeof raw === "number") {
    if (!Number.isSafeInteger(raw)) return null;
    return Object.is(raw, -0) ? 0 : raw;
  }
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (!/^[+-]?\d+$/.test(trimmed)) return null;

  const value = Number(trimmed);
  if (!Number.isSafeInteger(value)) return null;
  return Object.is(value, -0) ? 0 : value;
}

/**
 * @param {unknown} raw
 * @returns {string | null}
 */
function parseCursor(raw) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") {
    throw new PaginationError("invalid_cursor", "cursor must be a string");
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_CURSOR_LENGTH) {
    throw new PaginationError(
      "invalid_cursor",
      `cursor must be at most ${MAX_CURSOR_LENGTH} characters`,
    );
  }
  return trimmed;
}
