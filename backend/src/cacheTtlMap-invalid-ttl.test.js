import test from "node:test";
import assert from "node:assert/strict";

import { createCacheTtlMap } from "./cacheTtlMap.js";

test("a missing, non-positive, or non-finite TTL is rejected", () => {
  for (const ttlMs of [undefined, 0, -1, NaN, Infinity, -Infinity, "1000"]) {
    assert.throws(() => createCacheTtlMap({ ttlMs }), RangeError);
  }
  assert.throws(() => createCacheTtlMap(), RangeError);
});
