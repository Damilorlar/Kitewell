import test from "node:test";
import assert from "node:assert/strict";

import { formatErrorResponse } from "./errorResponseShape.js";

test("formatErrorResponse returns a fresh body on every call", () => {
  const first = formatErrorResponse("FAILED", "First failure");
  first.error.message = "changed";

  assert.deepEqual(formatErrorResponse("FAILED", "First failure"), {
    error: { code: "FAILED", message: "First failure" },
  });
});
