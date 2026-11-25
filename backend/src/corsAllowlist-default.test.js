import test from "node:test";
import assert from "node:assert/strict";

import { buildCorsOptions } from "./corsAllowlist.js";

test("unset allowlist denies all cross-origin requests", () => {
  assert.deepEqual(buildCorsOptions({}), { origin: [] });
});
