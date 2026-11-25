import test from "node:test";
import assert from "node:assert/strict";

import { splitMuxedAddress, buildMuxedAddress } from "./muxedAddressSplit.js";

const G = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

test("build then split is a lossless round-trip for a small id", () => {
  const mAddress = buildMuxedAddress(G, 7n);
  const { gAddress, id } = splitMuxedAddress(mAddress);
  assert.equal(gAddress, G);
  assert.equal(id, 7n);
});

test("build then split is a lossless round-trip for id=0", () => {
  const mAddress = buildMuxedAddress(G, 0n);
  const { gAddress, id } = splitMuxedAddress(mAddress);
  assert.equal(gAddress, G);
  assert.equal(id, 0n);
});

test("build accepts number and split always returns BigInt", () => {
  const mAddress = buildMuxedAddress(G, 99);
  const { id } = splitMuxedAddress(mAddress);
  assert.equal(typeof id, "bigint");
  assert.equal(id, 99n);
});

test("split then build reproduces the original M address", () => {
  const M_ID_42 = "MAAAAAAAAAAAAKQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALR6";
  const { gAddress, id } = splitMuxedAddress(M_ID_42);
  const rebuilt = buildMuxedAddress(gAddress, id);
  assert.equal(rebuilt, M_ID_42);
});
