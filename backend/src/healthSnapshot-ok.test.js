import test from "node:test";
import assert from "node:assert/strict";
import { buildHealthSnapshot } from "./healthSnapshot.js";

test("buildHealthSnapshot reports ok when Horizon is reachable", () => {
  const snapshot = buildHealthSnapshot({
    uptimeSeconds: 12,
    network: "testnet",
    horizonReachable: true,
    checkedAt: "2026-10-21T12:00:00.000Z",
  });

  assert.deepEqual(snapshot, {
    status: "ok",
    uptimeSeconds: 12,
    network: "testnet",
    horizonReachable: true,
    checkedAt: "2026-10-21T12:00:00.000Z",
  });
});
