import test from "node:test";
import assert from "node:assert/strict";

import { LOG_RECORD_ERROR } from "./logRedactConstants.js";
import { redactFields } from "./logRedact.js";

test("returns an error result instead of throwing", () => {
  assert.doesNotThrow(() => {
    const result = redactFields(null, null);
    assert.deepEqual(result, { ok: false, error: LOG_RECORD_ERROR });
  });
});
