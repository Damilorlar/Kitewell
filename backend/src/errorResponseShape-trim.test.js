import test from "node:test";
import assert from "node:assert/strict";

import { formatErrorResponse } from "./errorResponseShape.js";

test("formatErrorResponse trims both strings", () => {
  assert.deepEqual(formatErrorResponse("  INVALID_ADDRESS \n", "\tInvalid public key  "), {
    error: { code: "INVALID_ADDRESS", message: "Invalid public key" },
  });
});
