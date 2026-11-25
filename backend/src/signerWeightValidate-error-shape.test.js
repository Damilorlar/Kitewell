import test from "node:test";
import assert from "node:assert/strict";

import { SIGNER_WEIGHT_ERROR } from "./signerWeightValidateConstants.js";
import { validateSignerWeight } from "./signerWeightValidate.js";

// Verifies the exact shape and content of every failure result.

test("type error result has exactly ok and error keys", () => {
  const result = validateSignerWeight("bad");
  assert.deepEqual(Object.keys(result).sort(), ["error", "ok"]);
});

test("integer error result has exactly ok and error keys", () => {
  const result = validateSignerWeight(1.5);
  assert.deepEqual(Object.keys(result).sort(), ["error", "ok"]);
});

test("range error result has exactly ok and error keys", () => {
  const result = validateSignerWeight(256);
  assert.deepEqual(Object.keys(result).sort(), ["error", "ok"]);
});

test("success result has exactly ok and weight keys", () => {
  const result = validateSignerWeight(10);
  assert.deepEqual(Object.keys(result).sort(), ["ok", "weight"]);
});

test("TYPE error string is stable", () => {
  assert.equal(validateSignerWeight(null).error, SIGNER_WEIGHT_ERROR.TYPE);
});

test("INTEGER error string is stable", () => {
  assert.equal(validateSignerWeight(NaN).error,  SIGNER_WEIGHT_ERROR.INTEGER);
  assert.equal(validateSignerWeight(1.5).error,  SIGNER_WEIGHT_ERROR.INTEGER);
});

test("RANGE error string is stable", () => {
  assert.equal(validateSignerWeight(-1).error,  SIGNER_WEIGHT_ERROR.RANGE);
  assert.equal(validateSignerWeight(256).error, SIGNER_WEIGHT_ERROR.RANGE);
});

test("validateSignerWeight never throws on any input", () => {
  const inputs = [0, 255, 256, -1, 1.5, NaN, Infinity, -Infinity,
                  "10", "", null, undefined, true, false, [], {}, 10n,
                  Symbol("x")];
  for (const input of inputs) {
    assert.doesNotThrow(() => validateSignerWeight(input));
  }
});
