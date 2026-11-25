import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { createRequestIdMiddleware } from "./requestIdMiddleware.js";

function createRes() {
  const res = new EventEmitter();
  res.statusCode = 200;
  res.headers = {};
  res.locals = {};
  res.setHeader = (name, value) => {
    res.headers[name.toLowerCase()] = value;
  };
  return res;
}

test("propagates a generator failure instead of silently continuing", () => {
  const req = { method: "GET", originalUrl: "/health", headers: {} };
  const res = createRes();
  let nextCalls = 0;

  const middleware = createRequestIdMiddleware({
    generate: () => {
      throw new Error("no ids available");
    },
    logger: () => {},
  });

  assert.throws(
    () => middleware(req, res, () => {
      nextCalls += 1;
    }),
    /no ids available/,
  );
  assert.equal(nextCalls, 0);
});
