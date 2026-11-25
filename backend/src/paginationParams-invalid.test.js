import assert from "node:assert/strict";
import test from "node:test";

import { parsePaginationParams } from "./paginationParams.js";
import { PaginationError } from "./paginationParamsErrors.js";

function expectCode(run, code) {
  let caught;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof PaginationError);
  assert.equal(caught.code, code);
  return caught;
}

/**
 * Values that are not integers never reach the range check. Non-string
 * cursors and non-object queries fail before a page is returned.
 */

test("a non-numeric limit string throws invalid_limit", () => {
  const error = expectCode(
    () => parsePaginationParams({ limit: "abc" }),
    "invalid_limit",
  );
  assert.equal(error.name, "PaginationError");
  assert.ok(error instanceof Error);
});

test("a decimal limit throws invalid_limit", () => {
  expectCode(() => parsePaginationParams({ limit: "20.5" }), "invalid_limit");
});

test("scientific notation is not an integer limit", () => {
  expectCode(() => parsePaginationParams({ limit: "1e2" }), "invalid_limit");
});

test("an empty limit string throws invalid_limit", () => {
  expectCode(() => parsePaginationParams({ limit: "" }), "invalid_limit");
});

test("a boolean limit throws invalid_limit", () => {
  expectCode(() => parsePaginationParams({ limit: true }), "invalid_limit");
});

test("a fractional number throws invalid_limit", () => {
  expectCode(() => parsePaginationParams({ limit: 20.5 }), "invalid_limit");
});

test("NaN and Infinity are invalid limits", () => {
  for (const limit of [Number.NaN, Number.POSITIVE_INFINITY]) {
    expectCode(() => parsePaginationParams({ limit }), "invalid_limit");
  }
});

test("a non-string cursor throws invalid_cursor", () => {
  expectCode(() => parsePaginationParams({ cursor: 15 }), "invalid_cursor");
});

test("a non-object query throws invalid_query", () => {
  expectCode(() => parsePaginationParams("limit=20"), "invalid_query");
});
