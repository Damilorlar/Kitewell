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

test("generates a new id when the inbound header is blank", () => {
  const middleware = createRequestIdMiddleware({
    generate: () => "generated-id",
    logger: () => {},
  });

  for (const blank of ["", "   "]) {
    const req = {
      method: "GET",
      originalUrl: "/health",
      headers: { "x-request-id": blank },
    };
    const res = createRes();

    middleware(req, res, () => {});

    assert.equal(req.id, "generated-id");
    assert.equal(res.headers["x-request-id"], "generated-id");
  }
});
