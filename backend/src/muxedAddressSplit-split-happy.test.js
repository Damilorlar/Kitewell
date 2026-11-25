import test from "node:test";
import assert from "node:assert/strict";

import { splitMuxedAddress } from "./muxedAddressSplit.js";

// Known fixtures derived from the well-known G address GAAA...WHF.
const G = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const M_ID_0  = "MAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB5IG";
const M_ID_42 = "MAAAAAAAAAAAAKQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALR6";

test("splitMuxedAddress returns gAddress and id for a known M address", () => {
  const { gAddress, id } = splitMuxedAddress(M_ID_42);
  assert.equal(gAddress, G);
  assert.equal(id, 42n);
});

test("splitMuxedAddress id is always a BigInt", () => {
  const { id } = splitMuxedAddress(M_ID_42);
  assert.equal(typeof id, "bigint");
});

test("splitMuxedAddress returns a valid 56-char G... address", () => {
  const { gAddress } = splitMuxedAddress(M_ID_42);
  assert.match(gAddress, /^G/);
  assert.equal(gAddress.length, 56);
});

test("splitMuxedAddress handles id=0", () => {
  const { id, gAddress } = splitMuxedAddress(M_ID_0);
  assert.equal(id, 0n);
  assert.equal(gAddress, G);
});
