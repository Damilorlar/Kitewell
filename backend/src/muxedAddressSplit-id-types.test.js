import test from "node:test";
import assert from "node:assert/strict";

import { buildMuxedAddress } from "./muxedAddressSplit.js";

const G       = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const M_ID_100 = "MAAAAAAAAAAAAZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADMU4";

// All three accepted id representations must produce identical output.

test("BigInt, number, and string representations of the same id yield identical M addresses", () => {
  const fromBigInt = buildMuxedAddress(G, 100n);
  const fromNumber = buildMuxedAddress(G, 100);
  const fromString = buildMuxedAddress(G, "100");
  assert.equal(fromBigInt, M_ID_100);
  assert.equal(fromNumber, M_ID_100);
  assert.equal(fromString, M_ID_100);
});

test("Number.MAX_SAFE_INTEGER is accepted as a number id", () => {
  const m = buildMuxedAddress(G, Number.MAX_SAFE_INTEGER);
  assert.equal(typeof m, "string");
  assert.match(m, /^M/);
});

test("Number.MAX_SAFE_INTEGER matches its BigInt and string equivalents", () => {
  const n = Number.MAX_SAFE_INTEGER;
  assert.equal(
    buildMuxedAddress(G, n),
    buildMuxedAddress(G, BigInt(n)),
  );
  assert.equal(
    buildMuxedAddress(G, n),
    buildMuxedAddress(G, String(n)),
  );
});

test("buildMuxedAddress throws TypeError for NaN as id", () => {
  assert.throws(() => buildMuxedAddress(G, NaN), { name: "TypeError" });
});

test("buildMuxedAddress throws TypeError for Infinity as id", () => {
  assert.throws(() => buildMuxedAddress(G, Infinity), { name: "TypeError" });
});
