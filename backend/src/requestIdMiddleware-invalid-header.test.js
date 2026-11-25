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

test("replaces an unsafe inbound id instead of trusting it", () => {
  const middleware = createRequestIdMiddleware({
    generate: () => "fallback-id",
    logger: () => {},
  });

  for (const unsafe of ["id with space", "id/slash", "<script>", ["a", "b"]]) {
    const req = {
      method: "GET",
      originalUrl: "/health",
      headers: { "x-request-id": unsafe },
    };
    const res = createRes();

    middleware(req, res, () => {});

    assert.equal(req.id, "fallback-id");
    assert.equal(res.headers["x-request-id"], "fallback-id");
  }
});
