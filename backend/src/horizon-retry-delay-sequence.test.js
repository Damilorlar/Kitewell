import test from "node:test";
import assert from "node:assert/strict";

import { withHorizonRetry } from "./horizonRetry.js";

test("calls sleep with the exponentially growing delay before each retry", async () => {
  let calls = 0;
  const delays = [];

  await withHorizonRetry(
    async () => {
      calls += 1;
      if (calls < 4) throw new Error(`attempt ${calls}`);
      return "ok";
    },
    {
      maxAttempts: 4,
      baseDelayMs: 50,
      factor: 2,
      sleep: async (ms) => { delays.push(ms); },
    }
  );

  assert.deepEqual(delays, [50, 100, 200]);
});
