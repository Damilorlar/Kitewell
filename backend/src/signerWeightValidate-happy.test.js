import test from "node:test";
import assert from "node:assert/strict";

import { validateSignerWeight } from "./signerWeightValidate.js";

test("accepts a typical mid-range weight", () => {
  assert.deepEqual(validateSignerWeight(10), { ok: true, weight: 10 });
});

test("accepts the minimum valid weight 0", () => {
  assert.deepEqual(validateSignerWeight(0), { ok: true, weight: 0 });
});

test("accepts the maximum valid weight 255", () => {
  assert.deepEqual(validateSignerWeight(255), { ok: true, weight: 255 });
});

test("accepts weight 1 — the smallest positive value", () => {
  assert.deepEqual(validateSignerWeight(1), { ok: true, weight: 1 });
});

test("accepts weight 128 — a common half-threshold value", () => {
  assert.deepEqual(validateSignerWeight(128), { ok: true, weight: 128 });
});

test("returns the original weight number in the ok result", () => {
  const result = validateSignerWeight(42);
  assert.equal(result.ok, true);
  assert.equal(result.weight, 42);
});

test("result does not contain an error field on success", () => {
  const result = validateSignerWeight(5);
  assert.equal("error" in result, false);
});
