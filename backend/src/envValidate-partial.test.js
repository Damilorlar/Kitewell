import test from "node:test";
import assert from "node:assert/strict";

import { validateEnv } from "./envValidate.js";

test("reports only the names that are absent", () => {
  const result = validateEnv(
    { PORT: "8080", NETWORK: "public" },
    ["PORT", "SECRET", "NETWORK", "RPC"],
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(result.missing, ["SECRET", "RPC"]);
    assert.equal(result.values, undefined);
  }
});
