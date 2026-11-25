import test from "node:test";
import assert from "node:assert/strict";

import { withHorizonRetry } from "./horizonRetry.js";

test("retries after failures and resolves once fn succeeds", async () => {
  let calls = 0;
  const sleeps = [];
  const result = await withHorizonRetry(
    async () => {
      calls += 1;
      if (calls < 3) throw new Error("ECONNRESET");
      return "ok";
    },
    { maxAttempts: 3, sleep: async (ms) => { sleeps.push(ms); } }
  );

  assert.equal(result, "ok");
  assert.equal(calls, 3);
  assert.equal(sleeps.length, 2);
});
