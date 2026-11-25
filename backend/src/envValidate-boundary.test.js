import test from "node:test";
import assert from "node:assert/strict";

import { validateEnv } from "./envValidate.js";

test("an empty required list is valid", () => {
  assert.deepEqual(validateEnv({ UNUSED: "" }, []), { ok: true, values: {} });
});

test("a single required name is the lower bound", () => {
  assert.deepEqual(validateEnv({ A: "1" }, ["A"]), {
    ok: true,
    values: { A: "1" },
  });
});

test("whitespace-only is missing and surrounding spaces are trimmed", () => {
  const blank = validateEnv({ A: " \t " }, ["A"]);
  assert.equal(blank.ok, false);
  if (!blank.ok) assert.deepEqual(blank.missing, ["A"]);

  assert.deepEqual(validateEnv({ A: " x " }, ["A"]), {
    ok: true,
    values: { A: "x" },
  });
});

test("duplicate required names are checked once", () => {
  assert.deepEqual(validateEnv({ PORT: "1" }, ["PORT", " PORT ", "PORT"]), {
    ok: true,
    values: { PORT: "1" },
  });
});
