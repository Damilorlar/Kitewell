import test from "node:test";
import assert from "node:assert/strict";

import { resolveNetworkConfig } from "./networkConfigResolve.js";

test("resolveNetworkConfig returns the public Horizon URL and passphrase", () => {
  assert.deepEqual(resolveNetworkConfig("public"), {
    horizonUrl: "https://horizon.stellar.org",
    passphrase: "Public Global Stellar Network ; September 2015",
    friendbotUrl: null,
  });
});

test("resolveNetworkConfig leaves Friendbot unset on public", () => {
  const config = resolveNetworkConfig("public");

  assert.equal(config.friendbotUrl, null);
  assert.equal(config.horizonUrl, "https://horizon.stellar.org");
  assert.notEqual(
    config.passphrase,
    resolveNetworkConfig("testnet").passphrase,
  );
});
