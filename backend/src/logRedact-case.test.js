import test from "node:test";
import assert from "node:assert/strict";

import { REDACTED } from "./logRedactConstants.js";
import { redactFields } from "./logRedact.js";

test("matches field names without case or separator differences", () => {
  const result = redactFields(
    {
      Password: "a",
      API_KEY: "b",
      "private-key": "c",
      public: "d",
    },
    ["password", "apiKey", "privateKey"],
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.Password, REDACTED);
    assert.equal(result.value.API_KEY, REDACTED);
    assert.equal(result.value["private-key"], REDACTED);
    assert.equal(result.value.public, "d");
  }
});
