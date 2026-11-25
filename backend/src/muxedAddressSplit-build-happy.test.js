import test from "node:test";
import assert from "node:assert/strict";

import { buildMuxedAddress } from "./muxedAddressSplit.js";

const G     = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const M_ID_0  = "MAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB5IG";
const M_ID_42 = "MAAAAAAAAAAAAKQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALR6";

test("buildMuxedAddress returns the expected M address for BigInt id", () => {
  assert.equal(buildMuxedAddress(G, 42n), M_ID_42);
});

test("buildMuxedAddress accepts a number id", () => {
  assert.equal(buildMuxedAddress(G, 42), M_ID_42);
});

test("buildMuxedAddress accepts a decimal string id", () => {
  assert.equal(buildMuxedAddress(G, "42"), M_ID_42);
});

test("buildMuxedAddress handles id=0", () => {
  assert.equal(buildMuxedAddress(G, 0n), M_ID_0);
  assert.equal(buildMuxedAddress(G, 0), M_ID_0);
  assert.equal(buildMuxedAddress(G, "0"), M_ID_0);
});

test("buildMuxedAddress returns a string starting with M", () => {
  const m = buildMuxedAddress(G, 1n);
  assert.equal(typeof m, "string");
  assert.match(m, /^M/);
});
