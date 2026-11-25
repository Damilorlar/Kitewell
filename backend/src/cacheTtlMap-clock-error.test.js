import test from "node:test";
import assert from "node:assert/strict";

import { createCacheTtlMap } from "./cacheTtlMap.js";

test("a clock error propagates without replacing an existing entry", () => {
  let broken = false;
  const failure = new Error("clock unavailable");
  const cache = createCacheTtlMap({
    ttlMs: 10,
    now: () => {
      if (broken) throw failure;
      return 0;
    },
  });

  cache.set("account", "original");
  broken = true;
  assert.throws(() => cache.set("account", "replacement"), (error) => error === failure);
  assert.throws(() => cache.get("account"), (error) => error === failure);
  broken = false;
  assert.equal(cache.get("account"), "original");
});
