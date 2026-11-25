import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import {
  createRequestIdMiddleware,
  isValidRequestId,
  MAX_REQUEST_ID_LENGTH,
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

test("accepts a 128-character id and replaces a 129-character one", () => {
  const maxId = "a".repeat(MAX_REQUEST_ID_LENGTH);
  const tooLong = "a".repeat(MAX_REQUEST_ID_LENGTH + 1);

  assert.equal(isValidRequestId(maxId), true);
  assert.equal(isValidRequestId(tooLong), false);

  const middleware = createRequestIdMiddleware({
    generate: () => "generated-id",
    logger: () => {},
  });

  const keptReq = {
    method: "GET",
    originalUrl: "/health",
    headers: { "x-request-id": maxId },
  };
  middleware(keptReq, createRes(), () => {});
  assert.equal(keptReq.id, maxId);

  const replacedReq = {
    method: "GET",
    originalUrl: "/health",
    headers: { "x-request-id": tooLong },
  };
  middleware(replacedReq, createRes(), () => {});
  assert.equal(replacedReq.id, "generated-id");
});
