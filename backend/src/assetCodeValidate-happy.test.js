import test from "node:test";
import assert from "node:assert/strict";

import { validateAssetCode } from "./assetCodeValidate.js";

test("accepts a typical uppercase credit code", () => {
  assert.deepEqual(validateAssetCode("USDC"), { ok: true, code: "USDC" });
});

test("accepts a digit-only code", () => {
  assert.deepEqual(validateAssetCode("1"), { ok: true, code: "1" });
});

test("accepts mixed letters and digits", () => {
  assert.deepEqual(validateAssetCode("A1B2"), { ok: true, code: "A1B2" });
});

test("returns the original string without rewriting it", () => {
  const code = "KITEWELL";
  const result = validateAssetCode(code);
  assert.equal(result.ok, true);
  assert.equal(result.code, code);
});

test("accepts the native ticker when it is supplied as a code string", () => {
  assert.deepEqual(validateAssetCode("XLM"), { ok: true, code: "XLM" });
});
