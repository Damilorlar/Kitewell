import test from "node:test";
import assert from "node:assert/strict";

import { formatErrorResponse } from "./errorResponseShape.js";

test("formatErrorResponse preserves non-ASCII and long string content", () => {
  const message = "é".repeat(4096);
  assert.deepEqual(formatErrorResponse("ÉCHEC", message), {
    error: { code: "ÉCHEC", message },
  });
});
