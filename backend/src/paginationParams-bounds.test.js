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
 * Integers that parse cleanly but sit outside the inclusive window fail with
 * `limit_out_of_range`, including negatives and the values just past each end.
 */

test("zero is below the default minimum", () => {
  assert.throws(
    () => parsePaginationParams({ limit: "0" }),
    (error) => {
      assert.ok(error instanceof PaginationError);
      assert.equal(error.code, "limit_out_of_range");
      assert.match(error.message, /between 1 and 200/);
      return true;
    },
  );
});

test("a negative integer is out of range rather than non-numeric", () => {
  expectCode(() => parsePaginationParams({ limit: -3 }), "limit_out_of_range");
});

test("one above the default maximum is out of range", () => {
  expectCode(() => parsePaginationParams({ limit: "201" }), "limit_out_of_range");
});

test("custom bounds reject an integer that misses the new window", () => {
  const error = expectCode(
    () =>
      parsePaginationParams(
        { limit: "9" },
        { minLimit: 10, maxLimit: 30, defaultLimit: 10 },
      ),
    "limit_out_of_range",
  );
  assert.match(error.message, /between 10 and 30/);
});

test("custom bounds accept the new inclusive edges", () => {
  const options = { minLimit: 10, maxLimit: 30, defaultLimit: 15 };
  assert.equal(parsePaginationParams({ limit: "10" }, options).limit, 10);
  assert.equal(parsePaginationParams({ limit: 30 }, options).limit, 30);
});
