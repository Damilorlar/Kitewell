import test from "node:test";
import assert from "node:assert/strict";

import { resolveNetworkConfig } from "./networkConfigResolve.js";

test("resolveNetworkConfig returns the Testnet Horizon URL, passphrase, and Friendbot", () => {
  assert.deepEqual(resolveNetworkConfig("testnet"), {
    horizonUrl: "https://horizon-testnet.stellar.org",
    passphrase: "Test SDF Network ; September 2015",
    friendbotUrl: "https://friendbot.stellar.org",
  });
});

test("resolveNetworkConfig keeps the Testnet passphrase spaced exactly as published", () => {
  const config = resolveNetworkConfig("testnet");

  assert.equal(config.passphrase, "Test SDF Network ; September 2015");
  assert.equal(config.horizonUrl.startsWith("https://"), true);
  assert.equal(config.friendbotUrl, "https://friendbot.stellar.org");
});
