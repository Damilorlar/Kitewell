import test from "node:test";
import assert from "node:assert/strict";

import { isValidAssetCode, validateAssetCode } from "./assetCodeValidate.js";

test("isValidAssetCode returns true for a valid code", () => {
  assert.equal(isValidAssetCode("USDC"), true);
  assert.equal(isValidAssetCode("A"), true);
  assert.equal(isValidAssetCode("ABCDEFGHIJKL"), true);
});

test("isValidAssetCode returns false for invalid codes", () => {
  assert.equal(isValidAssetCode(""), false);
  assert.equal(isValidAssetCode("a"), false);
  assert.equal(isValidAssetCode("US-DC"), false);
  assert.equal(isValidAssetCode("ABCDEFGHIJKLM"), false);
  assert.equal(isValidAssetCode("A B"), false);
  assert.equal(isValidAssetCode(null), false);
  assert.equal(isValidAssetCode(undefined), false);
  assert.equal(isValidAssetCode(12), false);
});

test("the predicate matches validateAssetCode.ok", () => {
  const samples = ["A", "ABCDEFGHIJKL", "", "a", "US_DC", " ", null, 1, "1234567890123"];
  for (const sample of samples) {
    assert.equal(isValidAssetCode(sample), validateAssetCode(sample).ok);
  }
});

test("the predicate return value is a boolean", () => {
  assert.equal(typeof isValidAssetCode("BTC"), "boolean");
  assert.equal(typeof isValidAssetCode("btc"), "boolean");
});

test("the predicate does not throw on odd input", () => {
  assert.doesNotThrow(() => isValidAssetCode(Symbol("USDC")));
  assert.equal(isValidAssetCode(Symbol("USDC")), false);
});
