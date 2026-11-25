import test from "node:test";
import assert from "node:assert/strict";

import { formatErrorResponse } from "./errorResponseShape.js";

test("formatErrorResponse uses safe defaults when arguments are omitted", () => {
  assert.deepEqual(formatErrorResponse(), {
    error: { code: "UNKNOWN_ERROR", message: "An unexpected error occurred." },
  });
});
