import test from "node:test";
import assert from "node:assert/strict";

import { assertEnv, validateEnv } from "./envValidate.js";

test("does not mutate the environment record", () => {
  const env = { PORT: " 3000 ", SECRET: "   " };
  const snapshot = { ...env };

  validateEnv(env, ["PORT", "SECRET"]);
  assert.throws(() => assertEnv(env, ["PORT", "SECRET"]));

  assert.deepEqual(env, snapshot);
});
