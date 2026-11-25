import assert from "node:assert/strict";
import test from "node:test";

import { PAGINATION_DEFAULTS, parsePaginationParams } from "./paginationParams.js";

/**
 * Missing pieces of the query fall back to the documented defaults. A caller
 * that has not opted into custom bounds always gets limit 20 and a null cursor.
 */

test("an empty query uses defaultLimit and a null cursor", () => {
  assert.deepEqual(parsePaginationParams({}), {
    limit: PAGINATION_DEFAULTS.defaultLimit,
    cursor: null,
  });
});

test("a null query is treated as empty", () => {
  assert.deepEqual(parsePaginationParams(null), {
    limit: 20,
    cursor: null,
  });
});

test("an undefined query is treated as empty", () => {
  assert.deepEqual(parsePaginationParams(undefined), {
    limit: 20,
    cursor: null,
  });
});

test("omitting limit keeps defaultLimit when a cursor is present", () => {
  assert.deepEqual(parsePaginationParams({ cursor: "page-2" }), {
    limit: 20,
    cursor: "page-2",
  });
});

test("an explicit null limit is missing and uses defaultLimit", () => {
  assert.deepEqual(parsePaginationParams({ limit: null, cursor: null }), {
    limit: 20,
    cursor: null,
  });
});

test("omitted options leave the built-in bounds in place", () => {
  const parsed = parsePaginationParams({ limit: "20" });
  assert.equal(parsed.limit, PAGINATION_DEFAULTS.defaultLimit);
  assert.equal(PAGINATION_DEFAULTS.minLimit, 1);
  assert.equal(PAGINATION_DEFAULTS.maxLimit, 200);
});
