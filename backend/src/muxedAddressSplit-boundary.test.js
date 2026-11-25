import test from "node:test";
import assert from "node:assert/strict";

import { splitMuxedAddress, buildMuxedAddress } from "./muxedAddressSplit.js";

const G       = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const MAX_ID  = 18446744073709551615n;
const M_MAX   = "MD777777777777YAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABYWA";
const M_ID_1  = "MAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACTA4";

test("buildMuxedAddress accepts the maximum uint64 id", () => {
  assert.equal(buildMuxedAddress(G, MAX_ID), M_MAX);
});

test("splitMuxedAddress decodes the maximum uint64 id correctly", () => {
  const { id, gAddress } = splitMuxedAddress(M_MAX);
  assert.equal(id, MAX_ID);
  assert.equal(gAddress, G);
});

test("buildMuxedAddress accepts id=1 (smallest positive id)", () => {
  assert.equal(buildMuxedAddress(G, 1n), M_ID_1);
});

test("splitMuxedAddress decodes id=1 correctly", () => {
  const { id } = splitMuxedAddress(M_ID_1);
  assert.equal(id, 1n);
});

test("buildMuxedAddress accepts MAX_ID as a decimal string", () => {
  assert.equal(buildMuxedAddress(G, MAX_ID.toString()), M_MAX);
});

test("buildMuxedAddress rejects one above the maximum uint64", () => {
  assert.throws(() => buildMuxedAddress(G, MAX_ID + 1n), Error);
});
