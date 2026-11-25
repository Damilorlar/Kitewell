import test from "node:test";
import assert from "node:assert/strict";

import { assertEnv, validateEnv } from "./envValidate.js";

test("accepts a complete environment and returns trimmed values", () => {
  const result = validateEnv(
    { PORT: " 3000 ", NETWORK: "testnet" },
    ["PORT", "NETWORK"],
  );

  assert.deepEqual(result, {
    ok: true,
    values: { PORT: "3000", NETWORK: "testnet" },
  });
  assert.deepEqual(assertEnv({ PORT: "3000" }, ["PORT"]), { PORT: "3000" });
});
