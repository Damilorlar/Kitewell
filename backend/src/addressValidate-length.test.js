import test from "node:test";
import assert from "node:assert/strict";

import { isValidStellarAddress } from "./addressValidate.js";

test("rejects an address one character too short", () => {
  assert.equal(isValidStellarAddress(`GA${"A".repeat(53)}`), false);
});

test("rejects an address one character too long", () => {
  assert.equal(isValidStellarAddress(`GA${"A".repeat(55)}`), false);
});
