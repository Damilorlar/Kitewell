import test from "node:test";
import assert from "node:assert/strict";

import { buildCorsOptions } from "./corsAllowlist.js";

test("equivalent origins are normalized and deduplicated", () => {
  assert.deepEqual(
    buildCorsOptions({
      CORS_ALLOWLIST: "https://KITEWELL.example/,https://kitewell.example:443,http://localhost:80/",
    }),
    { origin: ["https://kitewell.example", "http://localhost"] },
  );
});
