import test from "node:test";
import assert from "node:assert/strict";

import { isValidStellarAddress } from "./addressValidate.js";

test("accepts a Stellar Ed25519 public key", () => {
  assert.equal(
    isValidStellarAddress("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"),
    true,
  );
});

test("accepts format-correct keys without checking their checksum", () => {
  assert.equal(isValidStellarAddress(`GA${"A".repeat(54)}`), true);
  assert.equal(isValidStellarAddress(`GD${"7".repeat(54)}`), true);
  assert.equal(isValidStellarAddress(`GA${"Z2".repeat(27)}`), true);
});
