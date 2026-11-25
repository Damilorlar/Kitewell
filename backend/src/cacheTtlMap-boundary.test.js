import test from "node:test";
import assert from "node:assert/strict";

import { createCacheTtlMap } from "./cacheTtlMap.js";

test("an entry expires exactly at its TTL boundary", () => {
  let time = 0;
  const cache = createCacheTtlMap({ ttlMs: 1, now: () => time });

  cache.set("account", 0);
  time = 0.999;
  assert.equal(cache.has("account"), true);
  time = 1;
  assert.equal(cache.has("account"), false);
  assert.equal(cache.get("account"), undefined);
});
