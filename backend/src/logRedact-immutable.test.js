import test from "node:test";
import assert from "node:assert/strict";

import { redactFields } from "./logRedact.js";

test("does not mutate the input record", () => {
  const record = { password: "hunter2", body: { token: "raw" } };
  const snapshot = structuredClone(record);

  redactFields(record);

  assert.deepEqual(record, snapshot);
});
