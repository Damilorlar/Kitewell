import test from "node:test";
import assert from "node:assert/strict";

import { RequestTimeoutError, requestTimeout } from "./requestTimeout.js";

test("NaN, Infinity, and -Infinity throw RequestTimeoutError before a timer exists", () => {
  let scheduled = 0;
  const options = {
    setTimer() {
      scheduled += 1;
      return 1;
    },
    clearTimer() {
      throw new Error("clearTimer must not run");
    },
  };

  for (const timeoutMs of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.throws(
      () => requestTimeout(timeoutMs, options),
      (err) => {
        assert.ok(err instanceof RequestTimeoutError);
        assert.equal(err.name, "RequestTimeoutError");
        assert.equal(err.reason, "non-finite");
        assert.equal(Object.is(err.timeoutMs, timeoutMs), true);
        assert.match(err.message, /finite/);
        assert.match(err.stack, /assertValidTimeoutMs/);
        return true;
      },
    );
  }

  assert.equal(scheduled, 0);
});

test("a valid timeout still returns middleware after other calls have thrown", () => {
  assert.throws(() => requestTimeout(Number.NaN), RequestTimeoutError);
  const middleware = requestTimeout(5, {
    setTimer() {
      return 1;
    },
    clearTimer() {},
  });
  assert.equal(typeof middleware, "function");
});
