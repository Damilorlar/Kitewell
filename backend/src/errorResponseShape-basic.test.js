import test from "node:test";
import assert from "node:assert/strict";

import { formatErrorResponse } from "./errorResponseShape.js";

test("formatErrorResponse wraps a code and message in the error shape", () => {
  assert.deepEqual(formatErrorResponse("ACCOUNT_NOT_FOUND", "Account not found"), {
    error: { code: "ACCOUNT_NOT_FOUND", message: "Account not found" },
  });
});
