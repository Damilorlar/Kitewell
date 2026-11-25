import test from "node:test";
import assert from "node:assert/strict";

import { ENV_MISSING_ERROR } from "./envValidateConstants.js";
import { validateEnv } from "./envValidate.js";

test("lists every missing variable in one result", () => {
  const result = validateEnv({ PORT: "3000" }, ["PORT", "HORIZON_URL", "NETWORK"]);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(result.missing, ["HORIZON_URL", "NETWORK"]);
    assert.equal(
      result.error,
      `${ENV_MISSING_ERROR}: HORIZON_URL, NETWORK`,
    );
  }
});
