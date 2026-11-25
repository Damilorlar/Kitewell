import test from "node:test";
import assert from "node:assert/strict";

import { ASSET_CODE_ERROR } from "./assetCodeValidateConstants.js";
import { validateAssetCode } from "./assetCodeValidate.js";

test("rejects a hyphen", () => {
  assert.deepEqual(validateAssetCode("US-DC"), {
    ok: false,
    error: ASSET_CODE_ERROR.CHARSET,
  });
});

test("rejects an underscore", () => {
  assert.deepEqual(validateAssetCode("US_DC"), {
    ok: false,
    error: ASSET_CODE_ERROR.CHARSET,
  });
});

test("rejects an embedded space", () => {
  assert.deepEqual(validateAssetCode("US DC"), {
    ok: false,
    error: ASSET_CODE_ERROR.CHARSET,
  });
});

test("rejects leading or trailing space", () => {
  assert.equal(validateAssetCode(" USDC").ok, false);
  assert.equal(validateAssetCode("USDC ").ok, false);
  assert.equal(validateAssetCode(" USDC").error, ASSET_CODE_ERROR.CHARSET);
});

test("rejects punctuation and symbols", () => {
  for (const code of ["USDC.", "A!", "@", "A/B", "A+B", "A#1"]) {
    assert.deepEqual(validateAssetCode(code), {
      ok: false,
      error: ASSET_CODE_ERROR.CHARSET,
    });
  }
});

test("rejects non-ASCII letters", () => {
  assert.equal(validateAssetCode("ÜSDC").ok, false);
  assert.equal(validateAssetCode("A😀").ok, false);
});

test("accepts every allowed character at least once", () => {
  assert.deepEqual(validateAssetCode("ABCDEFGHIJ09"), {
    ok: true,
    code: "ABCDEFGHIJ09",
  });
});
