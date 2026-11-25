import test from "node:test";
import assert from "node:assert/strict";
import { buildHealthSnapshot } from "./healthSnapshot.js";

test("buildHealthSnapshot accepts zero uptime", () => {
  const snapshot = buildHealthSnapshot({
    uptimeSeconds: 0,
    network: "testnet",
    horizonReachable: true,
    checkedAt: "2026-10-21T12:00:00.000Z",
  });

  assert.equal(snapshot.uptimeSeconds, 0);
  assert.equal(snapshot.status, "ok");
});
