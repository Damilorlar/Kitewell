import test from "node:test";
import assert from "node:assert/strict";

import { ENV_MISSING_ERROR, ENV_TYPE_ERROR } from "./envValidateConstants.js";
import { assertEnv } from "./envValidate.js";

test("assertEnv throws one error naming every missing variable", () => {
  assert.throws(
    () => assertEnv({ PORT: "1" }, ["PORT", "RPC", "NETWORK"]),
    (error) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, `${ENV_MISSING_ERROR}: RPC, NETWORK`);
      return true;
    },
  );
});

test("assertEnv throws the type error without a missing list", () => {
  assert.throws(
    () => assertEnv(null, ["PORT"]),
    (error) => error instanceof Error && error.message === ENV_TYPE_ERROR,
  );
});
