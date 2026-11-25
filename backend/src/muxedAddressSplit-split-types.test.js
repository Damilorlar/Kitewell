import test from "node:test";
import assert from "node:assert/strict";

import { splitMuxedAddress } from "./muxedAddressSplit.js";

// Verifies that splitMuxedAddress rejects every non-string primitive without
// attempting to coerce the value.

test("splitMuxedAddress throws TypeError for a number", () => {
  assert.throws(() => splitMuxedAddress(42), { name: "TypeError" });
});

test("splitMuxedAddress throws TypeError for a boolean", () => {
  assert.throws(() => splitMuxedAddress(true), { name: "TypeError" });
  assert.throws(() => splitMuxedAddress(false), { name: "TypeError" });
});

test("splitMuxedAddress throws TypeError for null", () => {
  assert.throws(() => splitMuxedAddress(null), { name: "TypeError" });
});

test("splitMuxedAddress throws TypeError for undefined", () => {
  assert.throws(() => splitMuxedAddress(undefined), { name: "TypeError" });
});

test("splitMuxedAddress throws TypeError for an array", () => {
  assert.throws(() => splitMuxedAddress([]), { name: "TypeError" });
});

test("splitMuxedAddress throws TypeError for an object", () => {
  assert.throws(() => splitMuxedAddress({}), { name: "TypeError" });
});

test("splitMuxedAddress does not coerce an object with a custom toString", () => {
  const obj = { toString() { return "MAAAAAAAAAAAAKQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALR6"; } };
  assert.throws(() => splitMuxedAddress(obj), { name: "TypeError" });
});
