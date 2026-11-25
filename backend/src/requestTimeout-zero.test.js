import test from "node:test";
import assert from "node:assert/strict";

import { requestTimeout } from "./requestTimeout.js";
import { RequestTimeoutError } from "./requestTimeoutErrors.js";

test("zero and negative zero throw and never schedule a timer", () => {
  let scheduled = 0;
  const options = {
    setTimer() {
      scheduled += 1;
      return scheduled;
    },
    clearTimer() {
      throw new Error("clearTimer must not run");
    },
  };

  for (const timeoutMs of [0, -0]) {
    assert.throws(
      () => requestTimeout(timeoutMs, options),
      (err) => {
        assert.ok(err instanceof RequestTimeoutError);
        assert.equal(err.name, "RequestTimeoutError");
        assert.equal(err.reason, "non-positive");
        assert.equal(Object.is(err.timeoutMs, timeoutMs), true);
        assert.match(err.message, /positive integer/);
        return true;
      },
    );
  }

  assert.equal(scheduled, 0);
});

test("a positive timeout is not treated as the zero rejection", () => {
  let scheduled = 0;
  const middleware = requestTimeout(1, {
    setTimer(fn, ms) {
      scheduled += 1;
      assert.equal(ms, 1);
      assert.equal(typeof fn, "function");
      return 7;
    },
    clearTimer() {},
  });

  const res = {
    headersSent: false,
    on() {
      return res;
    },
  };
  let nexted = false;
  middleware({}, res, () => {
    nexted = true;
  });

  assert.equal(scheduled, 1);
  assert.equal(nexted, true);
});
