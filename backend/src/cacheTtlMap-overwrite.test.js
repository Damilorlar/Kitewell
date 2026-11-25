import test from "node:test";
import assert from "node:assert/strict";

import { createCacheTtlMap } from "./cacheTtlMap.js";

test("setting an existing key replaces the value and restarts its TTL", () => {
  let time = 0;
  const cache = createCacheTtlMap({ ttlMs: 10, now: () => time });

  cache.set("account", "old");
  time = 8;
  cache.set("account", "new");
  time = 10;
  assert.equal(cache.get("account"), "new");
  time = 18;
  assert.equal(cache.has("account"), false);
});
