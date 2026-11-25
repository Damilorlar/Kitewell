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

test("writes one structured log line carrying the request id on finish", () => {
  const lines = [];
  const timestamps = [1000, 1042];
  let index = 0;

  const req = {
    method: "POST",
    originalUrl: "/api/payments/GABC",
    headers: { "x-request-id": "req-123" },
  };
  const res = createRes();
  res.statusCode = 201;

  createRequestIdMiddleware({
    logger: (line) => lines.push(line),
    now: () => timestamps[index++],
  })(req, res, () => {});

  assert.equal(lines.length, 0, "logs only when the response finishes");

  res.emit("finish");

  assert.equal(lines.length, 1);
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.requestId, "req-123");
  assert.equal(entry.method, "POST");
  assert.equal(entry.path, "/api/payments/GABC");
  assert.equal(entry.status, 201);
  assert.equal(entry.ms, 42);
  assert.equal(entry.level, "info");
  assert.ok(!Number.isNaN(Date.parse(entry.ts)));
});
