import test from "node:test";
import assert from "node:assert/strict";

import { buildMuxedAddress } from "./muxedAddressSplit.js";

const G = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

test("buildMuxedAddress throws TypeError when gAddress is not a string", () => {
  for (const value of [null, undefined, 42, true, [], {}]) {
    assert.throws(
      () => buildMuxedAddress(value, 1n),
      { name: "TypeError" },
    );
  }
});

test("buildMuxedAddress throws for an invalid G address", () => {
  assert.throws(() => buildMuxedAddress("NOTANADDRESS", 1n), Error);
});

test("buildMuxedAddress throws TypeError when id is null or undefined", () => {
  assert.throws(() => buildMuxedAddress(G, null),      { name: "TypeError" });
  assert.throws(() => buildMuxedAddress(G, undefined), { name: "TypeError" });
});

test("buildMuxedAddress throws TypeError for a floating-point number id", () => {
  assert.throws(() => buildMuxedAddress(G, 1.5),  { name: "TypeError" });
  assert.throws(() => buildMuxedAddress(G, -0.1), { name: "TypeError" });
});

test("buildMuxedAddress throws TypeError for a negative number id", () => {
  assert.throws(() => buildMuxedAddress(G, -1),  { name: "TypeError" });
  assert.throws(() => buildMuxedAddress(G, -1n), { name: "TypeError" });
});

test("buildMuxedAddress throws TypeError for a non-decimal string id", () => {
  assert.throws(() => buildMuxedAddress(G, "0x2a"), { name: "TypeError" });
  assert.throws(() => buildMuxedAddress(G, "1.0"),  { name: "TypeError" });
  assert.throws(() => buildMuxedAddress(G, ""),     { name: "TypeError" });
  assert.throws(() => buildMuxedAddress(G, " 42"),  { name: "TypeError" });
});

test("buildMuxedAddress throws for an id that exceeds uint64 max", () => {
  assert.throws(() => buildMuxedAddress(G, 18446744073709551616n), Error);
});
