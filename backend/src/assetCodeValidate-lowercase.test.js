import test from "node:test";
import assert from "node:assert/strict";

import { ASSET_CODE_ERROR } from "./assetCodeValidateConstants.js";
import { validateAssetCode } from "./assetCodeValidate.js";

test("rejects a single lowercase letter", () => {
  assert.deepEqual(validateAssetCode("a"), {
    ok: false,
    error: ASSET_CODE_ERROR.CHARSET,
  });
});

test("rejects a fully lowercase code", () => {
  assert.deepEqual(validateAssetCode("usdc"), {
    ok: false,
    error: ASSET_CODE_ERROR.CHARSET,
  });
});

test("rejects mixed case", () => {
  assert.equal(validateAssetCode("Usdc").ok, false);
  assert.equal(validateAssetCode("UsDC").error, ASSET_CODE_ERROR.CHARSET);
  assert.equal(validateAssetCode("ABc").error, ASSET_CODE_ERROR.CHARSET);
});

test("does not uppercase the input", () => {
  const result = validateAssetCode("xlm");
  assert.equal(result.ok, false);
  assert.equal("code" in result, false);
});

test("rejects a lowercased 12-character code", () => {
  assert.equal(validateAssetCode("ABCDEFGHIJKL".toLowerCase()).ok, false);
});

test("the same letters in uppercase are accepted", () => {
  assert.deepEqual(validateAssetCode("USDC"), { ok: true, code: "USDC" });
});
