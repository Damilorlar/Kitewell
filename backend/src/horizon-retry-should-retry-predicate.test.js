import test from "node:test";
import assert from "node:assert/strict";

import { withHorizonRetry } from "./horizonRetry.js";

class NotFoundError extends Error {}

test("stops immediately, without sleeping, when shouldRetry returns false", async () => {
  const failure = new NotFoundError("404");
  let calls = 0;
  let sleepCalls = 0;

  await assert.rejects(
    () =>
      withHorizonRetry(
        async () => {
          calls += 1;
          throw failure;
        },
        {
          maxAttempts: 5,
          sleep: async () => { sleepCalls += 1; },
          shouldRetry: (error) => !(error instanceof NotFoundError),
        }
      ),
    (error) => error === failure
  );

  assert.equal(calls, 1);
  assert.equal(sleepCalls, 0);
});
