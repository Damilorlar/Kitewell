import test from "node:test";
import assert from "node:assert/strict";

import { validateEnv } from "./envValidate.js";

test("empty string values are missing", () => {
  const result = validateEnv({ PORT: "", NETWORK: "testnet" }, ["PORT", "NETWORK"]);
  assert.equal(result.ok, false);
  if (!result.ok) assert.deepEqual(result.missing, ["PORT"]);
});

test("non-string values are missing", () => {
  const result = validateEnv({ PORT: 3000 }, ["PORT"]);
  assert.equal(result.ok, false);
  if (!result.ok) assert.deepEqual(result.missing, ["PORT"]);
});
