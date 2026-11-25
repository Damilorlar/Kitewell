import test from "node:test";
import assert from "node:assert/strict";

import { buildCorsOptions } from "./corsAllowlist.js";

test("whitespace and empty comma-separated entries are ignored", () => {
  assert.deepEqual(
    buildCorsOptions({ CORS_ALLOWLIST: " , https://one.example , , http://two.example:3000 , " }),
    { origin: ["https://one.example", "http://two.example:3000"] },
  );
});
