import test from "node:test";
import assert from "node:assert/strict";

import { createCacheTtlMap } from "./cacheTtlMap.js";

test("a non-function clock is rejected", () => {
  assert.throws(() => createCacheTtlMap({ ttlMs: 10, now: 0 }), TypeError);
});

test("non-finite clock readings are rejected when used", () => {
  let time = 0;
  const cache = createCacheTtlMap({ ttlMs: 10, now: () => time });

  cache.set("account", "balance");
  time = NaN;
  assert.throws(() => cache.get("account"), RangeError);
  assert.throws(() => cache.has("account"), RangeError);
  assert.throws(() => cache.set("other", "balance"), RangeError);
});

test("an unrepresentable expiry is rejected", () => {
  const cache = createCacheTtlMap({ ttlMs: Number.MAX_VALUE, now: () => Number.MAX_VALUE });

  assert.throws(() => cache.set("account", "balance"), RangeError);
  assert.equal(cache.has("account"), false);
});
