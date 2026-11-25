import assert from "node:assert/strict";
import test from "node:test";

import { parsePaginationParams } from "./paginationParams.js";

/**
 * In-range limits are returned as integers whether the query carried a string
 * (typical for HTTP) or an already-parsed number.
 */

test("a numeric limit string inside the default range is parsed", () => {
  assert.deepEqual(parsePaginationParams({ limit: "50", cursor: "abc" }), {
    limit: 50,
    cursor: "abc",
  });
});

test("a number limit inside the default range is kept", () => {
  assert.equal(parsePaginationParams({ limit: 7 }).limit, 7);
});

test("surrounding whitespace on a limit string is ignored", () => {
  assert.equal(parsePaginationParams({ limit: "  15\n" }).limit, 15);
});

test("a leading plus on an integer limit is accepted", () => {
  assert.equal(parsePaginationParams({ limit: "+42" }).limit, 42);
});

test("leading zeros do not change the integer value", () => {
  assert.equal(parsePaginationParams({ limit: "020" }).limit, 20);
});

test("a limit at the default minimum and maximum is accepted", () => {
  assert.equal(parsePaginationParams({ limit: "1" }).limit, 1);
  assert.equal(parsePaginationParams({ limit: "200" }).limit, 200);
});
