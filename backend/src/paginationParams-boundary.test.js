import assert from "node:assert/strict";
import test from "node:test";

import { MAX_CURSOR_LENGTH, parsePaginationParams } from "./paginationParams.js";
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
 * Edges of the default window, the cursor length cap, and a caller-supplied
 * single-value range. Values one step outside those edges fail.
 */

test("limit 1 and limit 200 are the inclusive default edges", () => {
  assert.equal(parsePaginationParams({ limit: 1 }).limit, 1);
  assert.equal(parsePaginationParams({ limit: 200 }).limit, 200);
});

test("limit just outside the default edges throws limit_out_of_range", () => {
  for (const limit of [0, 201]) {
    expectCode(() => parsePaginationParams({ limit }), "limit_out_of_range");
  }
});

test("a one-character cursor is the shortest non-empty value", () => {
  assert.equal(parsePaginationParams({ cursor: "x" }).cursor, "x");
});

test("cursor length 256 is accepted and 257 is rejected", () => {
  const ok = "b".repeat(MAX_CURSOR_LENGTH);
  assert.equal(parsePaginationParams({ cursor: ok }).cursor, ok);

  expectCode(() => parsePaginationParams({ cursor: `${ok}!` }), "invalid_cursor");
  assert.equal(ok.length + 1, 257);
});

test("a custom window treats its own edges as legal and the neighbors as not", () => {
  const options = { minLimit: 4, maxLimit: 4, defaultLimit: 4 };

  assert.equal(parsePaginationParams({ limit: "4" }, options).limit, 4);

  for (const limit of ["3", "5"]) {
    expectCode(
      () => parsePaginationParams({ limit }, options),
      "limit_out_of_range",
    );
  }
});

test("an integer past Number.MAX_SAFE_INTEGER is not a usable limit", () => {
  expectCode(
    () => parsePaginationParams({ limit: "9007199254740993" }),
    "invalid_limit",
  );
});

test("negative zero is normalized before the range check", () => {
  expectCode(() => parsePaginationParams({ limit: "-0" }), "limit_out_of_range");
});
