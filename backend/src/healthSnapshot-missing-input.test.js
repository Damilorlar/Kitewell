import test from "node:test";
import assert from "node:assert/strict";
import { buildHealthSnapshot } from "./healthSnapshot.js";

test("buildHealthSnapshot rejects a missing input object", () => {
  assert.throws(() => buildHealthSnapshot(null), /input must be an object/);
});
