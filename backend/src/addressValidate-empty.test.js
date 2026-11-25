import test from "node:test";
import assert from "node:assert/strict";

import { isValidStellarAddress } from "./addressValidate.js";

test("rejects an empty or whitespace-only address", () => {
  assert.equal(isValidStellarAddress(""), false);
  assert.equal(isValidStellarAddress(" ".repeat(56)), false);
});
