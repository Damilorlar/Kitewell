import test from "node:test";
import assert from "node:assert/strict";

import { withHorizonRetry } from "./horizonRetry.js";

test("rejects with a RangeError for a non-positive or non-integer maxAttempts, without calling fn", async () => {
  let calls = 0;
  const fn = async () => {
    calls += 1;
    return "unreachable";
  };

  await assert.rejects(() => withHorizonRetry(fn, { maxAttempts: 0 }), RangeError);
  await assert.rejects(() => withHorizonRetry(fn, { maxAttempts: -1 }), RangeError);
  await assert.rejects(() => withHorizonRetry(fn, { maxAttempts: 1.5 }), RangeError);
  assert.equal(calls, 0);
});
