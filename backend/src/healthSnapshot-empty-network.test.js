import test from "node:test";
import assert from "node:assert/strict";
import { buildHealthSnapshot } from "./healthSnapshot.js";

test("buildHealthSnapshot rejects an empty network", () => {
  assert.throws(
    () =>
      buildHealthSnapshot({
        uptimeSeconds: 1,
        network: "   ",
        horizonReachable: true,
      }),
    /network must be a non-empty string/,
  );
});
