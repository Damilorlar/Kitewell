import test from "node:test";
import assert from "node:assert/strict";

import { isValidSignerWeight, validateSignerWeight } from "./signerWeightValidate.js";

test("isValidSignerWeight returns true for valid weights", () => {
  assert.equal(isValidSignerWeight(0),   true);
  assert.equal(isValidSignerWeight(1),   true);
  assert.equal(isValidSignerWeight(128), true);
  assert.equal(isValidSignerWeight(255), true);
});

test("isValidSignerWeight returns false for out-of-range integers", () => {
  assert.equal(isValidSignerWeight(-1),  false);
  assert.equal(isValidSignerWeight(256), false);
});

test("isValidSignerWeight returns false for non-integer numbers", () => {
  assert.equal(isValidSignerWeight(1.5),      false);
  assert.equal(isValidSignerWeight(NaN),      false);
  assert.equal(isValidSignerWeight(Infinity), false);
});

test("isValidSignerWeight returns false for non-number inputs", () => {
  assert.equal(isValidSignerWeight("10"),     false);
  assert.equal(isValidSignerWeight(null),     false);
  assert.equal(isValidSignerWeight(undefined),false);
  assert.equal(isValidSignerWeight(true),     false);
  assert.equal(isValidSignerWeight([]),       false);
});

test("the predicate always matches validateSignerWeight.ok", () => {
  const samples = [0, 1, 128, 255, -1, 256, 1.5, NaN, "10", null, undefined, true, 10n];
  for (const sample of samples) {
    assert.equal(isValidSignerWeight(sample), validateSignerWeight(sample).ok);
  }
});

test("the predicate return value is always a boolean", () => {
  assert.equal(typeof isValidSignerWeight(10),   "boolean");
  assert.equal(typeof isValidSignerWeight(-1),   "boolean");
  assert.equal(typeof isValidSignerWeight(null), "boolean");
});

test("the predicate does not throw on symbol input", () => {
  assert.doesNotThrow(() => isValidSignerWeight(Symbol("10")));
  assert.equal(isValidSignerWeight(Symbol("10")), false);
});
