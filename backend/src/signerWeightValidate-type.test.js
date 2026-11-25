import test from "node:test";
import assert from "node:assert/strict";

import { SIGNER_WEIGHT_ERROR } from "./signerWeightValidateConstants.js";
import { validateSignerWeight } from "./signerWeightValidate.js";

test("rejects a string that looks like a valid weight", () => {
  assert.deepEqual(validateSignerWeight("10"), {
    ok: false,
    error: SIGNER_WEIGHT_ERROR.TYPE,
  });
});

test("rejects an empty string", () => {
  assert.deepEqual(validateSignerWeight(""), {
    ok: false,
    error: SIGNER_WEIGHT_ERROR.TYPE,
  });
});

test("rejects null without throwing", () => {
  assert.doesNotThrow(() => validateSignerWeight(null));
  assert.deepEqual(validateSignerWeight(null), {
    ok: false,
    error: SIGNER_WEIGHT_ERROR.TYPE,
  });
});

test("rejects undefined without throwing", () => {
  assert.deepEqual(validateSignerWeight(undefined), {
    ok: false,
    error: SIGNER_WEIGHT_ERROR.TYPE,
  });
});

test("rejects a boolean", () => {
  assert.deepEqual(validateSignerWeight(true), {
    ok: false,
    error: SIGNER_WEIGHT_ERROR.TYPE,
  });
  assert.deepEqual(validateSignerWeight(false), {
    ok: false,
    error: SIGNER_WEIGHT_ERROR.TYPE,
  });
});

test("rejects a BigInt", () => {
  assert.deepEqual(validateSignerWeight(10n), {
    ok: false,
    error: SIGNER_WEIGHT_ERROR.TYPE,
  });
});

test("rejects objects and arrays", () => {
  for (const value of [{}, { weight: 10 }, [], [10], new Number(10)]) {
    assert.deepEqual(validateSignerWeight(value), {
      ok: false,
      error: SIGNER_WEIGHT_ERROR.TYPE,
    });
  }
});

test("missing argument is treated as undefined and returns TYPE error", () => {
  assert.doesNotThrow(() => validateSignerWeight());
  assert.deepEqual(validateSignerWeight(), {
    ok: false,
    error: SIGNER_WEIGHT_ERROR.TYPE,
  });
});
