import test from "node:test";
import assert from "node:assert/strict";

import { buildCorsOptions } from "./corsAllowlist.js";

test("malformed and non-origin entries fail instead of being silently allowed", () => {
  for (const entry of [
    "kitewell.example",
    "https://",
    "file:///tmp/page",
    "https://*.example.com",
    "https://user:pass@example.com",
    "https://example.com/path",
    "https://example.com?query=1",
    "https://example.com#fragment",
    "https://example.com\\path",
    "https://exam\nple.com",
  ]) {
    assert.throws(
      () => buildCorsOptions({ CORS_ALLOWLIST: entry }),
      /Invalid CORS_ALLOWLIST origin at position 1/,
      entry,
    );
  }
});

test("an invalid later entry identifies its position", () => {
  assert.throws(
    () => buildCorsOptions({ CORS_ALLOWLIST: "https://good.example,https://bad.example/path" }),
    /Invalid CORS_ALLOWLIST origin at position 2/,
  );
});
