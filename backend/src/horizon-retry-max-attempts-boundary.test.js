import test from "node:test";
import assert from "node:assert/strict";

import { withHorizonRetry } from "./horizonRetry.js";

test("never retries when maxAttempts is 1", async () => {
  const failure = new Error("down");
  let calls = 0;
  let sleepCalls = 0;

  await assert.rejects(
    () =>
      withHorizonRetry(
        async () => {
          calls += 1;
          throw failure;
        },
        { maxAttempts: 1, sleep: async () => { sleepCalls += 1; } }
      ),
    (error) => error === failure
  );

  assert.equal(calls, 1);
  assert.equal(sleepCalls, 0);
});
