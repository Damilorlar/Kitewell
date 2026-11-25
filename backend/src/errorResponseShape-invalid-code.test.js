import test from "node:test";
import assert from "node:assert/strict";

import { formatErrorResponse } from "./errorResponseShape.js";

test("formatErrorResponse rejects a non-string code", () => {
  assert.throws(() => formatErrorResponse(404, "Not found"), {
    name: "TypeError",
    message: "code must be a string",
  });
  assert.throws(() => formatErrorResponse(null, "Not found"), TypeError);
});
