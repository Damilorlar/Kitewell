import test from "node:test";
import assert from "node:assert/strict";

import { isValidStellarAddress } from "./addressValidate.js";

test("rejects null, undefined, and non-string values", () => {
  for (const value of [null, undefined, 42, true, [], {}]) {
    assert.equal(isValidStellarAddress(value), false);
  }
});

test("does not coerce an object whose string conversion throws", () => {
  const value = { toString() { throw new Error("conversion failed"); } };
  assert.doesNotThrow(() => isValidStellarAddress(value));
  assert.equal(isValidStellarAddress(value), false);
});
