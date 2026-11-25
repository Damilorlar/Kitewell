import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

import { requestTimeout } from "./requestTimeout.js";

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

test("omitted options use the global timers and the standard 408 body", { timeout: 2_000 }, async () => {
  const res = fakeResponse();
  let nexted = false;
  const middleware = requestTimeout(20);

  middleware({}, res, () => {
    nexted = true;
  });

  assert.equal(typeof middleware, "function");
  assert.equal(nexted, true);
  assert.equal(res.body, undefined);

  await delay(60);

  assert.equal(res.statusCode, 408);
  assert.deepEqual(res.body, { error: "request_timeout", timeoutMs: 20 });
});

test("undefined and null options match the global-timer default", { timeout: 2_000 }, async () => {
  const undefinedRes = fakeResponse();
  const nullRes = fakeResponse();

  requestTimeout(20, undefined)({}, undefinedRes, () => {});
  requestTimeout(20, null)({}, nullRes, () => {});

  await delay(60);

  assert.deepEqual(undefinedRes.body, { error: "request_timeout", timeoutMs: 20 });
  assert.deepEqual(nullRes.body, { error: "request_timeout", timeoutMs: 20 });
  assert.equal(undefinedRes.statusCode, 408);
  assert.equal(nullRes.statusCode, 408);
});

test("an empty options object still clears on finish before the default timer", { timeout: 2_000 }, async () => {
  const res = fakeResponse();
  const middleware = requestTimeout(40, {});

  middleware({}, res, () => {
    res.emit("finish");
  });

  await delay(70);

  assert.equal(res.statusCode, 200);
  assert.equal(res.headersSent, false);
  assert.equal(res.body, undefined);
});
