import test from "node:test";
import assert from "node:assert/strict";

import { redactFields } from "./logRedact.js";

test("keeps unrelated fields and their original values", () => {
  const tags = ["pay"];
  const result = redactFields({ password: "x", tags, memo: "pay" }, ["password"]);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.password, "[redacted]");
    assert.equal(result.value.tags, tags);
    assert.equal(result.value.memo, "pay");
  }
});
