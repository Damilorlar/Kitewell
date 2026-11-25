import test from "node:test";
import assert from "node:assert/strict";

import { REDACTED } from "./logRedactConstants.js";
import { redactFields } from "./logRedact.js";

test("redacts default sensitive query and body fields", () => {
  const result = redactFields({
    account: "GABC",
    password: "hunter2",
    note: "ok",
  });

  assert.deepEqual(result, {
    ok: true,
    value: { account: "GABC", password: REDACTED, note: "ok" },
  });
});
