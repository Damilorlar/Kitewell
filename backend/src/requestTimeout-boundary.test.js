import test from "node:test";
import assert from "node:assert/strict";

import { requestTimeout } from "./requestTimeout.js";
import { RequestTimeoutError } from "./requestTimeoutErrors.js";

function createFakeTimers() {
  let now = 0;
  let nextId = 1;
  const queue = [];

  return {
    setTimer(fn, ms) {
      const id = nextId;
      nextId += 1;
      queue.push({ id, at: now + ms, fn });
      return id;
    },
    clearTimer(id) {
      const index = queue.findIndex((entry) => entry.id === id);
      if (index >= 0) queue.splice(index, 1);
    },
    advance(ms) {
      now += ms;
      const due = queue
        .filter((entry) => entry.at <= now)
        .sort((a, b) => a.at - b.at || a.id - b.id);
      for (const entry of due) {
        const index = queue.indexOf(entry);
        if (index < 0) continue;
        queue.splice(index, 1);
        entry.fn();
      }
    },
    pending() {
      return queue.length;
    },
  };
}

function fakeResponse() {
  const res = {
    statusCode: 200,
    headersSent: false,
    body: undefined,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.body = payload;
      res.headersSent = true;
      return res;
    },
    on() {
      return res;
    },
  };
  return res;
}

test("1ms is the smallest accepted timeout and fires on that tick", () => {
  const timers = createFakeTimers();
  const middleware = requestTimeout(1, {
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  const res = fakeResponse();
  let nexted = false;

  middleware({}, res, () => {
    nexted = true;
  });

  assert.equal(nexted, true);
  assert.equal(res.body, undefined);
  timers.advance(1);
  assert.deepEqual(res.body, { error: "request_timeout", timeoutMs: 1 });
  assert.equal(res.statusCode, 408);
});

test("1.0 is an integer timeout and a value one millisecond early does not fire", () => {
  const timers = createFakeTimers();
  const middleware = requestTimeout(1.0, {
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  const res = fakeResponse();

  middleware({}, res, () => {});
  timers.advance(0);
  assert.equal(res.body, undefined);

  const early = fakeResponse();
  requestTimeout(2, {
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  })({}, early, () => {});

  timers.advance(1);
  assert.deepEqual(res.body, { error: "request_timeout", timeoutMs: 1 });
  assert.equal(early.body, undefined, "2ms timeout has 1ms left");

  timers.advance(1);
  assert.deepEqual(early.body, { error: "request_timeout", timeoutMs: 2 });
});

test("Number.MAX_SAFE_INTEGER is accepted and does not fire early", () => {
  const timers = createFakeTimers();
  const timeoutMs = Number.MAX_SAFE_INTEGER;
  const middleware = requestTimeout(timeoutMs, {
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  const res = fakeResponse();
  let nexted = false;

  assert.equal(typeof middleware, "function");
  middleware({}, res, () => {
    nexted = true;
  });

  timers.advance(1_000);
  assert.equal(nexted, true);
  assert.equal(res.body, undefined);
  assert.equal(res.statusCode, 200);
  assert.equal(timers.pending(), 1);
});

test("the integer just below the positive range is rejected", () => {
  assert.throws(
    () => requestTimeout(-1),
    (err) => {
      assert.ok(err instanceof RequestTimeoutError);
      assert.equal(err.reason, "non-positive");
      assert.equal(err.timeoutMs, -1);
      return true;
    },
  );
});
