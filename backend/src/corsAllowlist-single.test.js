import test from "node:test";
import assert from "node:assert/strict";
import cors from "cors";

import { buildCorsOptions } from "./corsAllowlist.js";

test("one configured origin is returned as a cors option", () => {
  assert.deepEqual(buildCorsOptions({ CORS_ALLOWLIST: "https://kitewell.example" }), {
    origin: ["https://kitewell.example"],
  });
});

test("the cors middleware allows the configured origin only", () => {
  const middleware = cors(buildCorsOptions({ CORS_ALLOWLIST: "https://kitewell.example" }));

  function responseFor(origin) {
    const headers = new Map();
    middleware(
      { method: "GET", headers: { origin } },
      {
        getHeader: (name) => headers.get(name.toLowerCase()),
        setHeader: (name, value) => headers.set(name.toLowerCase(), value),
      },
      () => {},
    );
    return headers;
  }

  assert.equal(
    responseFor("https://kitewell.example").get("access-control-allow-origin"),
    "https://kitewell.example",
  );
  assert.equal(
    responseFor("https://other.example").get("access-control-allow-origin"),
    undefined,
  );
});
