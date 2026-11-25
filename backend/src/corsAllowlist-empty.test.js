import test from "node:test";
import assert from "node:assert/strict";

import { buildCorsOptions } from "./corsAllowlist.js";

test("empty and comma-only values produce an empty allowlist", () => {
  assert.deepEqual(buildCorsOptions({ CORS_ALLOWLIST: "" }), { origin: [] });
  assert.deepEqual(buildCorsOptions({ CORS_ALLOWLIST: " , , " }), { origin: [] });
});
