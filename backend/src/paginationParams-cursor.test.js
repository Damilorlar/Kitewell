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
 * Cursors are opaque strings. Blank values disappear; surrounding whitespace
 * is trimmed; length is measured after that trim.
 */

test("a missing cursor is null", () => {
  assert.equal(parsePaginationParams({ limit: "5" }).cursor, null);
});

test("an empty cursor is null", () => {
  assert.equal(parsePaginationParams({ cursor: "" }).cursor, null);
});

test("a whitespace-only cursor is null", () => {
  assert.equal(parsePaginationParams({ cursor: " \t\n " }).cursor, null);
});

test("a cursor is returned trimmed", () => {
  assert.equal(
    parsePaginationParams({ cursor: "  next-page  " }).cursor,
    "next-page",
  );
});

test("internal spaces survive trimming", () => {
  assert.equal(
    parsePaginationParams({ cursor: "  abc def  " }).cursor,
    "abc def",
  );
});

test("a cursor of exactly 256 characters is accepted", () => {
  const cursor = "c".repeat(MAX_CURSOR_LENGTH);
  assert.equal(parsePaginationParams({ cursor }).cursor, cursor);
  assert.equal(cursor.length, 256);
});

test("padding around a 256 character cursor is trimmed away", () => {
  const cursor = "d".repeat(MAX_CURSOR_LENGTH);
  assert.equal(parsePaginationParams({ cursor: `  ${cursor}  ` }).cursor, cursor);
});

test("a cursor longer than 256 characters is rejected", () => {
  expectCode(
    () => parsePaginationParams({ cursor: "e".repeat(MAX_CURSOR_LENGTH + 1) }),
    "invalid_cursor",
  );
});
