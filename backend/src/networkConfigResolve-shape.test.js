import test from "node:test";
import assert from "node:assert/strict";

import {
  SUPPORTED_NETWORK_NAMES,
  resolveNetworkConfig,
} from "./networkConfigResolve.js";

test("resolveNetworkConfig returns exactly horizonUrl, passphrase, and friendbotUrl", () => {
  for (const name of SUPPORTED_NETWORK_NAMES) {
    const config = resolveNetworkConfig(name);
    assert.deepEqual(Object.keys(config).sort(), [
      "friendbotUrl",
      "horizonUrl",
      "passphrase",
    ]);
    assert.equal(typeof config.horizonUrl, "string");
    assert.equal(typeof config.passphrase, "string");
    assert.equal(
      config.friendbotUrl === null || typeof config.friendbotUrl === "string",
      true,
    );
  }
});

test("resolveNetworkConfig returns a fresh object on each call", () => {
  const first = resolveNetworkConfig("testnet");
  first.horizonUrl = "https://example.invalid";

  const second = resolveNetworkConfig("testnet");
  assert.equal(second.horizonUrl, "https://horizon-testnet.stellar.org");
  assert.notEqual(first, second);
});

test("SUPPORTED_NETWORK_NAMES lists only testnet and public", () => {
  assert.deepEqual([...SUPPORTED_NETWORK_NAMES], ["testnet", "public"]);
});
