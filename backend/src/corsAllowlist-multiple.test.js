import test from "node:test";
import assert from "node:assert/strict";

import { buildCorsOptions } from "./corsAllowlist.js";

test("multiple HTTP and HTTPS origins retain their configured order", () => {
  assert.deepEqual(
    buildCorsOptions({ CORS_ALLOWLIST: "https://kitewell.example,http://localhost:5173" }),
    { origin: ["https://kitewell.example", "http://localhost:5173"] },
  );
});
