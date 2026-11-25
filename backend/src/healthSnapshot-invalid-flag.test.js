import test from "node:test";
import assert from "node:assert/strict";
import { buildHealthSnapshot } from "./healthSnapshot.js";

test("buildHealthSnapshot rejects a non-boolean reachability flag", () => {
  assert.throws(
    () =>
      buildHealthSnapshot({
        uptimeSeconds: 1,
        network: "testnet",
        horizonReachable: "yes",
      }),
    /horizonReachable must be a boolean/,
  );
});
