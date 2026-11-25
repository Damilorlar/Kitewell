import test from "node:test";
import assert from "node:assert/strict";

import { LOG_FIELDS_ERROR, LOG_RECORD_ERROR } from "./logRedactConstants.js";
import { redactFields } from "./logRedact.js";

test("rejects records that are not plain objects", () => {
  for (const record of [null, undefined, "password", 1, ["password"], () => {}]) {
    assert.deepEqual(redactFields(record), {
      ok: false,
      error: LOG_RECORD_ERROR,
    });
  }
});

test("rejects a sensitive-name list that is not strings", () => {
  const record = { password: "x" };
  for (const fields of [null, "password", ["password", 1], [""], ["  "]]) {
    const result = redactFields(record, fields);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, LOG_FIELDS_ERROR);
  }
});
