import test from "node:test";
import assert from "node:assert/strict";

import { ENV_REQUIRED_ERROR, ENV_TYPE_ERROR } from "./envValidateConstants.js";
import { validateEnv } from "./envValidate.js";

test("rejects a non-object environment", () => {
  for (const env of [null, undefined, "PORT=1", 1, ["PORT"]]) {
    assert.deepEqual(validateEnv(env, ["PORT"]), {
      ok: false,
      error: ENV_TYPE_ERROR,
      missing: [],
    });
  }
});

test("rejects a required list that is not names", () => {
  const env = { PORT: "3000" };
  for (const required of [null, "PORT", ["PORT", 1], ["", "PORT"], ["  "]]) {
    const result = validateEnv(env, required);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, ENV_REQUIRED_ERROR);
      assert.deepEqual(result.missing, []);
    }
  }
});
