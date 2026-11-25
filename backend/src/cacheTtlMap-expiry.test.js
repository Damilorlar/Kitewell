import test from "node:test";
import assert from "node:assert/strict";

import { createCacheTtlMap } from "./cacheTtlMap.js";

test("get returns a value before expiry and evicts it after expiry", () => {
  let time = 100;
  const cache = createCacheTtlMap({ ttlMs: 10, now: () => time });

  cache.set("account", "balance");
  time = 109;
  assert.equal(cache.get("account"), "balance");
  time = 111;
  assert.equal(cache.get("account"), undefined);
  assert.equal(cache.has("account"), false);
});
