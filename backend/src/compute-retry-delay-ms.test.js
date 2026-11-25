import test from "node:test";
import assert from "node:assert/strict";

import { computeRetryDelayMs } from "./horizonRetry.js";

test("grows exponentially with the default base and factor", () => {
  assert.equal(computeRetryDelayMs(1), 200);
  assert.equal(computeRetryDelayMs(2), 400);
  assert.equal(computeRetryDelayMs(3), 800);
});

test("respects a custom base delay and factor", () => {
  assert.equal(computeRetryDelayMs(1, 100, 3), 100);
  assert.equal(computeRetryDelayMs(2, 100, 3), 300);
  assert.equal(computeRetryDelayMs(3, 100, 3), 900);
});

test("caps the delay at maxDelayMs", () => {
  assert.equal(computeRetryDelayMs(5, 200, 2, 1000), 1000);
});
