import test from "node:test";
import assert from "node:assert/strict";

import { ASSET_CODE_ERROR } from "./assetCodeValidateConstants.js";
import { validateAssetCode } from "./assetCodeValidate.js";

test("rejects the empty string", () => {
  assert.deepEqual(validateAssetCode(""), {
    ok: false,
    error: ASSET_CODE_ERROR.LENGTH,
  });
});

test("rejects length 13", () => {
  assert.deepEqual(validateAssetCode("ABCDEFGHIJKLM"), {
    ok: false,
    error: ASSET_CODE_ERROR.LENGTH,
  });
});

test("rejects a much longer code", () => {
  assert.equal(validateAssetCode("A".repeat(64)).ok, false);
  assert.equal(validateAssetCode("A".repeat(64)).error, ASSET_CODE_ERROR.LENGTH);
});

test("accepts lengths 2, 4, 5, and 11", () => {
  for (const code of ["AB", "USDC", "ABCDE", "ABCDEFGHIJK"]) {
    assert.deepEqual(validateAssetCode(code), { ok: true, code });
  }
});

test("does not trim before measuring length", () => {
  assert.equal(validateAssetCode(" ").error, ASSET_CODE_ERROR.CHARSET);
  const padded = "A ".repeat(6);
  assert.equal(padded.length, 12);
  assert.equal(validateAssetCode(padded).error, ASSET_CODE_ERROR.CHARSET);
});
