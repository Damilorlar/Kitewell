import test from "node:test";
import assert from "node:assert/strict";

import { ASSET_CODE_ERROR } from "./assetCodeValidateConstants.js";
import { validateAssetCode } from "./assetCodeValidate.js";

test("rejects null without throwing", () => {
  assert.doesNotThrow(() => validateAssetCode(null));
  assert.deepEqual(validateAssetCode(null), {
    ok: false,
    error: ASSET_CODE_ERROR.TYPE,
  });
});

test("rejects undefined without throwing", () => {
  assert.deepEqual(validateAssetCode(undefined), {
    ok: false,
    error: ASSET_CODE_ERROR.TYPE,
  });
});

test("rejects numbers, booleans, and bigints", () => {
  for (const value of [0, 1, 12, Number.NaN, true, false, 1n]) {
    assert.deepEqual(validateAssetCode(value), {
      ok: false,
      error: ASSET_CODE_ERROR.TYPE,
    });
  }
});

test("rejects objects and arrays", () => {
  for (const value of [{}, { code: "USDC" }, [], ["USDC"], new String("USDC")]) {
    assert.deepEqual(validateAssetCode(value), {
      ok: false,
      error: ASSET_CODE_ERROR.TYPE,
    });
  }
});

test("rejects a function", () => {
  assert.equal(validateAssetCode(() => "USDC").ok, false);
});

test("missing argument is invalid and does not throw", () => {
  assert.doesNotThrow(() => validateAssetCode());
  assert.equal(validateAssetCode().error, ASSET_CODE_ERROR.TYPE);
});
