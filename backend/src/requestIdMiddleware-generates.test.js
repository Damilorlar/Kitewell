import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import {
  createRequestIdMiddleware,
  REQUEST_ID_HEADER,
} from "./requestIdMiddleware.js";

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

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

test("generates a request id, attaches it, and echoes it in the header", () => {
  const req = { method: "GET", originalUrl: "/health", headers: {} };
  const res = createRes();
  let nextCalls = 0;

  createRequestIdMiddleware({ logger: () => {} })(req, res, () => {
    nextCalls += 1;
  });

  assert.match(req.id, UUID);
  assert.equal(req.requestId, req.id);
  assert.equal(res.locals.requestId, req.id);
  assert.equal(res.headers[REQUEST_ID_HEADER.toLowerCase()], req.id);
  assert.equal(nextCalls, 1);
});
