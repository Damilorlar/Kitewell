import test from "node:test";
import assert from "node:assert/strict";

import { isValidStellarAddress } from "./addressValidate.js";

test("rejects a G prefix that decodes to the wrong version byte", () => {
  assert.equal(isValidStellarAddress(`GE${"A".repeat(54)}`), false);
  assert.equal(isValidStellarAddress(`G7${"A".repeat(54)}`), false);
});
