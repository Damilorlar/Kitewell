import test from "node:test";
import assert from "node:assert/strict";

import { buildCorsOptions } from "./corsAllowlist.js";

test("non-string allowlist values fail with a configuration error", () => {
  assert.throws(
    () => buildCorsOptions({ CORS_ALLOWLIST: ["https://kitewell.example"] }),
    { name: "TypeError", message: "CORS_ALLOWLIST must be a comma-separated string" },
  );
  assert.throws(() => buildCorsOptions({ CORS_ALLOWLIST: null }), TypeError);
});
