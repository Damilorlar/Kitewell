import test from "node:test";
import assert from "node:assert/strict";

import { withHorizonRetry } from "./horizonRetry.js";

test("resolves with the first attempt's result and never sleeps", async () => {
  let calls = 0;
  let sleepCalls = 0;
  const result = await withHorizonRetry(
    async () => {
      calls += 1;
      return "ok";
    },
    { sleep: async () => { sleepCalls += 1; } }
  );

  assert.equal(result, "ok");
  assert.equal(calls, 1);
  assert.equal(sleepCalls, 0);
});
