import test from "node:test";
import assert from "node:assert/strict";

import { SIGNER_WEIGHT_ERROR } from "./signerWeightValidateConstants.js";
import { validateSignerWeight } from "./signerWeightValidate.js";

test("rejects a fractional value", () => {
  assert.deepEqual(validateSignerWeight(1.5), {
    ok: false,
    error: SIGNER_WEIGHT_ERROR.INTEGER,
  });
});

test("rejects a value with a very small fractional part", () => {
  assert.deepEqual(validateSignerWeight(10.0000000001), {
    ok: false,
    error: SIGNER_WEIGHT_ERROR.INTEGER,
  });
});

test("rejects NaN", () => {
  assert.deepEqual(validateSignerWeight(NaN), {
    ok: false,
    error: SIGNER_WEIGHT_ERROR.INTEGER,
  });
});

test("rejects Infinity", () => {
  assert.deepEqual(validateSignerWeight(Infinity), {
    ok: false,
    error: SIGNER_WEIGHT_ERROR.INTEGER,
  });
});

test("rejects negative Infinity", () => {
  assert.deepEqual(validateSignerWeight(-Infinity), {
    ok: false,
    error: SIGNER_WEIGHT_ERROR.INTEGER,
  });
});

test("integer written as a float (10.0) is accepted", () => {
  // 10.0 is identical to the integer 10 in IEEE-754; Number.isInteger(10.0) is true.
  assert.deepEqual(validateSignerWeight(10.0), { ok: true, weight: 10 });
});
