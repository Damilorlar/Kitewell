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

test("reads and writes the configured header name", () => {
  const req = {
    method: "GET",
    originalUrl: "/health",
    headers: { "x-trace-id": "trace-1" },
  };
  const res = createRes();

  createRequestIdMiddleware({ headerName: "X-Trace-Id", logger: () => {} })(
    req,
    res,
    () => {},
  );

  assert.equal(req.id, "trace-1");
  assert.equal(res.headers["x-trace-id"], "trace-1");
  assert.equal(res.headers["x-request-id"], undefined);
});
