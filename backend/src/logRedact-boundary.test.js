import test from "node:test";
import assert from "node:assert/strict";

import { redactFields } from "./logRedact.js";

test("an empty field list redacts nothing", () => {
  assert.deepEqual(redactFields({ password: "x" }, []), {
    ok: true,
    value: { password: "x" },
  });
});

test("an empty record stays empty", () => {
  assert.deepEqual(redactFields({}, ["password"]), { ok: true, value: {} });
});

test("a single configured field is the lower bound", () => {
  assert.deepEqual(redactFields({ a: "secret" }, ["a"]), {
    ok: true,
    value: { a: "[redacted]" },
  });
});

test("a long field name still matches exactly", () => {
  const name = `token${"x".repeat(80)}`;
  const result = redactFields({ [name]: "value", other: 1 }, [name]);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value[name], "[redacted]");
    assert.equal(result.value.other, 1);
  }
});
