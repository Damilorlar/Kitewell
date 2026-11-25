import test from "node:test";
import assert from "node:assert/strict";

import { requestTimeout } from "./requestTimeout.js";

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
  };
}

function fakeResponse() {
  const res = {
    statusCode: 200,
    headersSent: false,
    body: undefined,
    statusCalls: 0,
    jsonCalls: 0,
    status(code) {
      res.statusCalls += 1;
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.jsonCalls += 1;
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

test("a timeout does not write JSON when headers were already sent", () => {
  const timers = createFakeTimers();
  const middleware = requestTimeout(12, {
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  const res = fakeResponse();

  middleware({}, res, () => {
    res.headersSent = true;
    res.statusCode = 200;
    res.body = { ok: true };
  });

  timers.advance(12);

  assert.equal(res.statusCalls, 0);
  assert.equal(res.jsonCalls, 0);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true });
});

test("a timeout still writes 408 when headers have not been sent", () => {
  const timers = createFakeTimers();
  const middleware = requestTimeout(8, {
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  const res = fakeResponse();

  middleware({}, res, () => {
    assert.equal(res.headersSent, false);
  });

  timers.advance(8);

  assert.equal(res.statusCalls, 1);
  assert.equal(res.jsonCalls, 1);
  assert.equal(res.headersSent, true);
  assert.deepEqual(res.body, { error: "request_timeout", timeoutMs: 8 });
});

test("headers sent between scheduling and firing suppress the timeout body", () => {
  const timers = createFakeTimers();
  const middleware = requestTimeout(5, {
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  const res = fakeResponse();

  middleware({}, res, () => {});
  res.status(202).json({ accepted: true });
  timers.advance(5);

  assert.equal(res.statusCode, 202);
  assert.deepEqual(res.body, { accepted: true });
  assert.equal(res.statusCalls, 1);
  assert.equal(res.jsonCalls, 1);
});
