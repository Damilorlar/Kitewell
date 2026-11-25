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
    pending() {
      return queue.length;
    },
  };
}

function fakeResponse() {
  const listeners = new Map();
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
    on(event, fn) {
      const list = listeners.get(event) ?? [];
      list.push(fn);
      listeners.set(event, list);
      return res;
    },
    emit(event) {
      for (const fn of listeners.get(event) ?? []) fn();
    },
  };
  return res;
}

test("middleware calls next immediately and answers 408 when the timer fires", () => {
  const timers = createFakeTimers();
  const middleware = requestTimeout(40, {
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  const res = fakeResponse();
  let nextCalls = 0;

  middleware({ url: "/reports/1" }, res, () => {
    nextCalls += 1;
  });

  assert.equal(nextCalls, 1);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, undefined);
  assert.equal(timers.pending(), 1);

  timers.advance(39);
  assert.equal(res.body, undefined, "the response stays open until the deadline");

  timers.advance(1);
  assert.equal(res.statusCode, 408);
  assert.deepEqual(res.body, { error: "request_timeout", timeoutMs: 40 });
  assert.equal(timers.pending(), 0);
  assert.equal(nextCalls, 1);
});

test("each request keeps its own timer and timeout value", () => {
  const timers = createFakeTimers();
  const fast = requestTimeout(10, {
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  const slow = requestTimeout(25, {
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  const fastRes = fakeResponse();
  const slowRes = fakeResponse();

  fast({}, fastRes, () => {});
  slow({}, slowRes, () => {});

  timers.advance(10);
  assert.deepEqual(fastRes.body, { error: "request_timeout", timeoutMs: 10 });
  assert.equal(slowRes.body, undefined);

  timers.advance(15);
  assert.deepEqual(slowRes.body, { error: "request_timeout", timeoutMs: 25 });
  assert.equal(fastRes.statusCode, 408);
  assert.equal(slowRes.statusCode, 408);
});
