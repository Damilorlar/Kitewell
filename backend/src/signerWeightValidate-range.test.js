import test from "node:test";
import assert from "node:assert/strict";

import { SIGNER_WEIGHT_ERROR } from "./signerWeightValidateConstants.js";
import { validateSignerWeight } from "./signerWeightValidate.js";

test("rejects -1 (one below the minimum)", () => {
  assert.deepEqual(validateSignerWeight(-1), {
    ok: false,
    error: SIGNER_WEIGHT_ERROR.RANGE,
  });
});

test("rejects 256 (one above the maximum)", () => {
  assert.deepEqual(validateSignerWeight(256), {
    ok: false,
    error: SIGNER_WEIGHT_ERROR.RANGE,
  });
});

test("rejects a large positive integer", () => {
  assert.deepEqual(validateSignerWeight(1000), {
    ok: false,
    error: SIGNER_WEIGHT_ERROR.RANGE,
  });
});

test("rejects a large negative integer", () => {
  assert.deepEqual(validateSignerWeight(-100), {
    ok: false,
    error: SIGNER_WEIGHT_ERROR.RANGE,
  });
});

test("rejects Number.MAX_SAFE_INTEGER", () => {
  assert.deepEqual(validateSignerWeight(Number.MAX_SAFE_INTEGER), {
    ok: false,
    error: SIGNER_WEIGHT_ERROR.RANGE,
  });
});
