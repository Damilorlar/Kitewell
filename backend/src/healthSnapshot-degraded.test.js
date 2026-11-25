import test from "node:test";
import assert from "node:assert/strict";
import { buildHealthSnapshot } from "./healthSnapshot.js";

test("buildHealthSnapshot reports degraded when Horizon is unreachable", () => {
  const snapshot = buildHealthSnapshot({
    uptimeSeconds: 3,
    network: "testnet",
    horizonReachable: false,
    checkedAt: "2026-10-21T12:00:00.000Z",
  });

  assert.equal(snapshot.status, "degraded");
  assert.equal(snapshot.horizonReachable, false);
});
