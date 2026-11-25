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

test("reuses a valid inbound request id", () => {
  const inboundId = "6f1a1b2c-3d4e-5f60-7a8b-9c0d1e2f3a4b";
  const req = {
    method: "GET",
    originalUrl: "/api/network",
    headers: { "x-request-id": inboundId },
  };
  const res = createRes();

  createRequestIdMiddleware({ logger: () => {} })(req, res, () => {});

  assert.equal(req.id, inboundId);
  assert.equal(res.locals.requestId, inboundId);
  assert.equal(res.headers["x-request-id"], inboundId);
});
