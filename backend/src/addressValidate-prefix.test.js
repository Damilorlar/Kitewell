import test from "node:test";
import assert from "node:assert/strict";

import { isValidStellarAddress } from "./addressValidate.js";

test("rejects other Stellar key types", () => {
  for (const prefix of ["C", "M", "S", "X"]) {
    assert.equal(isValidStellarAddress(`${prefix}A${"A".repeat(54)}`), false);
  }
});
