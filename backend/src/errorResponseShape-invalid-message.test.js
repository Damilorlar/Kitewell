import test from "node:test";
import assert from "node:assert/strict";

import { formatErrorResponse } from "./errorResponseShape.js";

test("formatErrorResponse rejects a non-string message", () => {
  assert.throws(() => formatErrorResponse("FAILED", new Error("internal detail")), {
    name: "TypeError",
    message: "message must be a string",
  });
  assert.throws(() => formatErrorResponse("FAILED", false), TypeError);
});
