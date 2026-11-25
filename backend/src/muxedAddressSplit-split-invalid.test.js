import test from "node:test";
import assert from "node:assert/strict";

import { splitMuxedAddress } from "./muxedAddressSplit.js";

test("splitMuxedAddress throws TypeError for a non-string argument", () => {
  for (const value of [null, undefined, 42, true, [], {}]) {
    assert.throws(
      () => splitMuxedAddress(value),
      { name: "TypeError" },
    );
  }
});

test("splitMuxedAddress throws for an empty string", () => {
  assert.throws(() => splitMuxedAddress(""), Error);
});

test("splitMuxedAddress throws for a G address instead of M address", () => {
  assert.throws(
    () => splitMuxedAddress("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"),
    Error,
  );
});

test("splitMuxedAddress throws for a corrupted M address", () => {
  // Valid length but wrong checksum / contents.
  assert.throws(
    () => splitMuxedAddress("MAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAZBAD"),
    Error,
  );
});

test("splitMuxedAddress throws for a C contract address", () => {
  assert.throws(
    () => splitMuxedAddress("CA7QYNF7SOWQ3GLR2BGMZEHXR44KVLDVPVKJSQBK7VVFNJZM54MTXZAABCD"),
    Error,
  );
});
