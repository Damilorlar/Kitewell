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

test("a throwing logger does not fail the request", () => {
  const req = { method: "GET", originalUrl: "/health", headers: {} };
  const res = createRes();
  let nextCalls = 0;

  createRequestIdMiddleware({
    logger: () => {
      throw new Error("logger unavailable");
    },
  })(req, res, () => {
    nextCalls += 1;
  });

  assert.equal(nextCalls, 1);
  assert.doesNotThrow(() => res.emit("finish"));
  assert.equal(res.headers["x-request-id"], req.id);
});
