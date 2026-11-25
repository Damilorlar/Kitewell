import test from "node:test";
import assert from "node:assert/strict";

import { SIGNER_WEIGHT_ERROR } from "./signerWeightValidateConstants.js";
import { validateSignerWeight } from "./signerWeightValidate.js";

// The module must not silently coerce values into numbers.
// A caller passing "10" should get an explicit error, not a silent success.

test("does not coerce a numeric string to a number", () => {
  assert.deepEqual(validateSignerWeight("10"), {
    ok: false,
    error: SIGNER_WEIGHT_ERROR.TYPE,
  });
});

test("does not coerce the string '0' to the number 0", () => {
  assert.deepEqual(validateSignerWeight("0"), {
    ok: false,
    error: SIGNER_WEIGHT_ERROR.TYPE,
  });
});

test("does not coerce the string '255' to the number 255", () => {
  assert.deepEqual(validateSignerWeight("255"), {
    ok: false,
    error: SIGNER_WEIGHT_ERROR.TYPE,
  });
});

test("does not coerce true to 1", () => {
  assert.deepEqual(validateSignerWeight(true), {
    ok: false,
    error: SIGNER_WEIGHT_ERROR.TYPE,
  });
});

test("does not coerce false to 0", () => {
  assert.deepEqual(validateSignerWeight(false), {
    ok: false,
    error: SIGNER_WEIGHT_ERROR.TYPE,
  });
});

test("does not coerce null to 0", () => {
  assert.deepEqual(validateSignerWeight(null), {
    ok: false,
    error: SIGNER_WEIGHT_ERROR.TYPE,
  });
});

test("an object with valueOf returning a valid weight is still rejected", () => {
  const obj = { valueOf() { return 10; } };
  assert.deepEqual(validateSignerWeight(obj), {
    ok: false,
    error: SIGNER_WEIGHT_ERROR.TYPE,
  });
});
