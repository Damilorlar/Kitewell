import test from "node:test";
import assert from "node:assert/strict";
import { buildHealthSnapshot } from "./healthSnapshot.js";

test("buildHealthSnapshot rejects a negative uptime", () => {
  assert.throws(
    () =>
      buildHealthSnapshot({
        uptimeSeconds: -1,
        network: "testnet",
        horizonReachable: true,
      }),
    /uptimeSeconds must be a non-negative finite number/,
  );
});
