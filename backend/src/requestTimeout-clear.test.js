import test from "node:test";
import assert from "node:assert/strict";

import { requestTimeout } from "./requestTimeout.js";

function createFakeTimers() {
  let now = 0;
  let nextId = 1;
  const queue = [];
  let clears = 0;

  return {
    clears() {
      return clears;
    },
    setTimer(fn, ms) {
      const id = nextId;
      nextId += 1;
      queue.push({ id, at: now + ms, fn });
      return id;
    },
    clearTimer(id) {
      clears += 1;
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

test("finish clears the timer so a later tick cannot send 408", () => {
  const timers = createFakeTimers();
  const middleware = requestTimeout(30, {
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  const res = fakeResponse();

  middleware({}, res, () => {
    res.status(200).json({ ok: true });
    res.emit("finish");
  });

  assert.equal(timers.pending(), 0);
  assert.equal(timers.clears(), 1);
  timers.advance(30);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true });
});

test("close clears the timer and a second finish does not clear again", () => {
  const timers = createFakeTimers();
  const middleware = requestTimeout(15, {
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  const res = fakeResponse();

  middleware({}, res, () => {
    res.emit("close");
    res.emit("finish");
  });

  assert.equal(timers.clears(), 1);
  assert.equal(timers.pending(), 0);
  timers.advance(15);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, undefined);
  assert.equal(res.headersSent, false);
});

test("one request ending does not cancel another request's timer", () => {
  const timers = createFakeTimers();
  const middleware = requestTimeout(20, {
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  const done = fakeResponse();
  const hanging = fakeResponse();

  middleware({}, done, () => {
    done.emit("finish");
  });
  middleware({}, hanging, () => {});

  assert.equal(timers.pending(), 1);
  timers.advance(20);
  assert.equal(done.body, undefined);
  assert.deepEqual(hanging.body, { error: "request_timeout", timeoutMs: 20 });
});
