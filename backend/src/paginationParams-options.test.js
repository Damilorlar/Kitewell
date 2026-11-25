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
 * Callers can tighten or shift the window. The resolved default still has to
 * sit inside the resolved inclusive range, and min cannot exceed max.
 */

test("defaultLimit overrides the fallback when limit is missing", () => {
  assert.equal(
    parsePaginationParams({}, { defaultLimit: 40 }).limit,
    40,
  );
});

test("a partial override keeps the other defaults when they still fit", () => {
  const parsed = parsePaginationParams(
    {},
    { minLimit: 5 },
  );
  assert.equal(parsed.limit, 20);
});

test("minLimit greater than maxLimit is rejected", () => {
  const error = expectCode(
    () => parsePaginationParams({}, { minLimit: 50, maxLimit: 10, defaultLimit: 20 }),
    "invalid_options",
  );
  assert.match(error.message, /minLimit cannot be greater than maxLimit/);
});

test("a default below the overridden minimum is rejected", () => {
  const error = expectCode(
    () => parsePaginationParams({}, { minLimit: 30 }),
    "invalid_options",
  );
  assert.match(error.message, /defaultLimit must be within/);
});

test("a default above the overridden maximum is rejected", () => {
  expectCode(
    () => parsePaginationParams({}, { maxLimit: 10, defaultLimit: 20 }),
    "invalid_options",
  );
});

test("a non-integer option is rejected", () => {
  const error = expectCode(
    () => parsePaginationParams({}, { minLimit: 1.5 }),
    "invalid_options",
  );
  assert.match(error.message, /minLimit must be a safe integer/);
});

test("options must be an object", () => {
  expectCode(() => parsePaginationParams({}, "20"), "invalid_options");
});

test("equal min and max are allowed when the default matches them", () => {
  const parsed = parsePaginationParams(
    {},
    { minLimit: 8, maxLimit: 8, defaultLimit: 8 },
  );
  assert.equal(parsed.limit, 8);
});
