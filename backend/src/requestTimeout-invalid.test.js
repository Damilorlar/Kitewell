import test from "node:test";
import assert from "node:assert/strict";

import { requestTimeout } from "./requestTimeout.js";
import { RequestTimeoutError } from "./requestTimeoutErrors.js";

function rejectingTimers() {
  return {
    setTimer() {
      throw new Error("setTimer must not run for invalid timeoutMs");
    },
    clearTimer() {
      throw new Error("clearTimer must not run for invalid timeoutMs");
    },
  };
}

/**
 * @param {unknown} timeoutMs
 * @param {string} reason
 */
function assertRejected(timeoutMs, reason) {
  const timers = rejectingTimers();
  assert.throws(
    () => requestTimeout(timeoutMs, timers),
    (err) => {
      assert.ok(err instanceof RequestTimeoutError);
      assert.ok(err instanceof Error);
      assert.equal(err.name, "RequestTimeoutError");
      assert.equal(err.reason, reason);
      assert.equal(err.timeoutMs, timeoutMs);
      assert.match(err.message, /timeoutMs/);
      return true;
    },
  );
}

test("non-number timeoutMs is rejected and does not arm a timer", () => {
  assertRejected(undefined, "invalid-type");
  assertRejected(null, "invalid-type");
  assertRejected("40", "invalid-type");
  assertRejected(true, "invalid-type");
  assertRejected({}, "invalid-type");
  assertRejected([], "invalid-type");
});

test("fractional timeoutMs is rejected as a non-integer", () => {
  assertRejected(1.5, "non-integer");
  assertRejected(0.1, "non-integer");
  assertRejected(-1.5, "non-integer");
});
