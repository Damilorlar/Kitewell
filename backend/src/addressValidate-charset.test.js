import test from "node:test";
import assert from "node:assert/strict";

import { isValidStellarAddress } from "./addressValidate.js";

test("rejects characters outside the unpadded base32 alphabet", () => {
  for (const character of ["0", "1", "8", "9", "=", "-", " "]) {
    assert.equal(isValidStellarAddress(`GA${character}${"A".repeat(53)}`), false);
  }
});
