import test from "node:test";
import assert from "node:assert/strict";

import { createCacheTtlMap } from "./cacheTtlMap.js";

test("set and get cache a value by key", () => {
  const cache = createCacheTtlMap({ ttlMs: 1_000 });

  assert.equal(cache.get("account"), undefined);
  cache.set("account", { balance: "12.5000000" });
  assert.deepEqual(cache.get("account"), { balance: "12.5000000" });
  assert.equal(cache.get("other"), undefined);
});

test("cache instances keep separate values", () => {
  const first = createCacheTtlMap({ ttlMs: 1_000 });
  const second = createCacheTtlMap({ ttlMs: 1_000 });

  first.set("account", "first");
  assert.equal(second.has("account"), false);
  second.set("account", "second");
  assert.equal(first.get("account"), "first");
  assert.equal(second.get("account"), "second");
});
