import test from "node:test";
import assert from "node:assert/strict";

import { SIGNER_WEIGHT_ERROR } from "./signerWeightValidateConstants.js";
import { validateSignerWeight } from "./signerWeightValidate.js";

// ── lower boundary ──────────────────────────────────────────────────────────

test("0 is valid (inclusive minimum)", () => {
  assert.deepEqual(validateSignerWeight(0), { ok: true, weight: 0 });
});

test("-1 is invalid (one below the minimum)", () => {
  assert.deepEqual(validateSignerWeight(-1), {
    ok: false,
    error: SIGNER_WEIGHT_ERROR.RANGE,
  });
});

// ── upper boundary ──────────────────────────────────────────────────────────

test("255 is valid (inclusive maximum)", () => {
  assert.deepEqual(validateSignerWeight(255), { ok: true, weight: 255 });
});

test("256 is invalid (one above the maximum)", () => {
  assert.deepEqual(validateSignerWeight(256), {
    ok: false,
    error: SIGNER_WEIGHT_ERROR.RANGE,
  });
});

// ── just-inside boundaries ──────────────────────────────────────────────────

test("1 is valid (smallest positive weight)", () => {
  assert.deepEqual(validateSignerWeight(1), { ok: true, weight: 1 });
});

test("254 is valid (one below the maximum)", () => {
  assert.deepEqual(validateSignerWeight(254), { ok: true, weight: 254 });
});
