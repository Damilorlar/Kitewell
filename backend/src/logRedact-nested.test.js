import test from "node:test";
import assert from "node:assert/strict";

import { REDACTED } from "./logRedactConstants.js";
import { redactFields } from "./logRedact.js";

test("redacts sensitive keys inside query and body objects", () => {
  const result = redactFields({
    query: { account: "GABC", token: "raw" },
    body: { memo: "pay", secret: "seed" },
    path: "/pay",
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value, {
      query: { account: "GABC", token: REDACTED },
      body: { memo: "pay", secret: REDACTED },
      path: "/pay",
    });
  }
});

test("does not walk past the first nested object", () => {
  const result = redactFields(
    { body: { meta: { password: "still-here" } } },
    ["password"],
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value.body, { meta: { password: "still-here" } });
  }
});
