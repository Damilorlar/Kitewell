import test from "node:test";
import assert from "node:assert/strict";

import { isValidStellarAddress } from "./addressValidate.js";

test("rejects lowercase characters without normalizing the input", () => {
  assert.equal(isValidStellarAddress(`gA${"A".repeat(54)}`), false);
  assert.equal(isValidStellarAddress(`GAa${"A".repeat(53)}`), false);
});
