import test from "node:test";
import assert from "node:assert/strict";

import { formatErrorResponse } from "./errorResponseShape.js";

test("formatErrorResponse replaces whitespace-only strings with defaults", () => {
  assert.deepEqual(formatErrorResponse(" \t ", "\n "), {
    error: { code: "UNKNOWN_ERROR", message: "An unexpected error occurred." },
  });
});
