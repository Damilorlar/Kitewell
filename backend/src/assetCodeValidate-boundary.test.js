import test from "node:test";
import assert from "node:assert/strict";

import { ASSET_CODE_ERROR } from "./assetCodeValidateConstants.js";
import { validateAssetCode } from "./assetCodeValidate.js";

test("length 1 code A is valid", () => {
  assert.deepEqual(validateAssetCode("A"), { ok: true, code: "A" });
});

test("length 1 digit 0 is valid", () => {
  assert.deepEqual(validateAssetCode("0"), { ok: true, code: "0" });
});

test("length 12 code ABCDEFGHIJKL is valid", () => {
  assert.deepEqual(validateAssetCode("ABCDEFGHIJKL"), {
    ok: true,
    code: "ABCDEFGHIJKL",
  });
});

test("length 12 digits are valid", () => {
  const code = "123456789012";
  assert.equal(code.length, 12);
  assert.deepEqual(validateAssetCode(code), { ok: true, code });
});

test("length 0 is invalid", () => {
  assert.deepEqual(validateAssetCode(""), {
    ok: false,
    error: ASSET_CODE_ERROR.LENGTH,
  });
});

test("length 13 is invalid", () => {
  const code = "ABCDEFGHIJKLM";
  assert.equal(code.length, 13);
  assert.deepEqual(validateAssetCode(code), {
    ok: false,
    error: ASSET_CODE_ERROR.LENGTH,
  });
});

test("one past the digit ceiling is invalid", () => {
  const code = "1234567890123";
  assert.equal(code.length, 13);
  assert.equal(validateAssetCode(code).ok, false);
});
