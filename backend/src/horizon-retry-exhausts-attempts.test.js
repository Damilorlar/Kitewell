import test from "node:test";
import assert from "node:assert/strict";

import { withHorizonRetry } from "./horizonRetry.js";

test("rejects with the last error once maxAttempts is reached", async () => {
  const failure = new Error("still down");
  let calls = 0;
  const sleeps = [];

  await assert.rejects(
    () =>
      withHorizonRetry(
        async () => {
          calls += 1;
          throw failure;
        },
        { maxAttempts: 3, sleep: async (ms) => { sleeps.push(ms); } }
      ),
    (error) => error === failure
  );

  assert.equal(calls, 3);
  assert.equal(sleeps.length, 2);
});
