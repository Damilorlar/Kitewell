import test from "node:test";
import assert from "node:assert/strict";

import { createCacheTtlMap } from "./cacheTtlMap.js";

test("has distinguishes an undefined value from an absent key", () => {
  const cache = createCacheTtlMap({ ttlMs: 1_000 });

  cache.set("present", undefined);
  assert.equal(cache.get("present"), undefined);
  assert.equal(cache.has("present"), true);
  assert.equal(cache.has("missing"), false);
});

test("object keys use Map identity", () => {
  const cache = createCacheTtlMap({ ttlMs: 1_000 });
  const key = { account: "GABC" };

  cache.set(key, 42);
  assert.equal(cache.has(key), true);
  assert.equal(cache.has({ account: "GABC" }), false);
});
