import test from "node:test";
import assert from "node:assert/strict";
import * as StellarSdk from "@stellar/stellar-sdk";

import {
  DEFAULT_NETWORK,
  NETWORK_PRESETS,
  SUPPORTED_NETWORKS,
  resolveNetwork,
} from "./networkConfig.js";

test("resolveNetwork defaults to Testnet when NETWORK is unset", () => {
  assert.deepEqual(resolveNetwork({}), {
    network: "TESTNET",
    passphrase: StellarSdk.Networks.TESTNET,
    horizonUrl: "https://horizon-testnet.stellar.org",
    friendbotUrl: "https://friendbot.stellar.org",
    explorerBase: "https://stellar.expert/explorer/testnet",
    sorobanRpcUrl: "https://soroban-testnet.stellar.org",
  });
  assert.equal(DEFAULT_NETWORK, "TESTNET");
});

test("resolveNetwork treats a blank NETWORK as unset", () => {
  assert.equal(resolveNetwork({ NETWORK: "" }).network, "TESTNET");
  assert.equal(resolveNetwork({ NETWORK: "   " }).network, "TESTNET");
});

test("resolveNetwork uses the Futurenet passphrase and URLs", () => {
  const config = resolveNetwork({ NETWORK: "FUTURENET" });

  assert.deepEqual(config, {
    network: "FUTURENET",
    passphrase: StellarSdk.Networks.FUTURENET,
    horizonUrl: "https://horizon-futurenet.stellar.org",
    friendbotUrl: null,
    explorerBase: "https://stellar.expert/explorer/futurenet",
    sorobanRpcUrl: "https://rpc-futurenet.stellar.org",
  });

  // The bug this guards against: a Futurenet config reporting the Testnet passphrase.
  assert.notEqual(config.passphrase, StellarSdk.Networks.TESTNET);
});

test("resolveNetwork accepts a case-insensitive network id", () => {
  assert.equal(resolveNetwork({ NETWORK: "futurenet" }).network, "FUTURENET");
  assert.equal(resolveNetwork({ NETWORK: " Futurenet " }).network, "FUTURENET");
  assert.equal(resolveNetwork({ NETWORK: "testnet" }).network, "TESTNET");
});

test("resolveNetwork lets env URLs override the Testnet defaults", () => {
  const config = resolveNetwork({
    NETWORK: "TESTNET",
    HORIZON_URL: "https://horizon.internal.example",
    FRIENDBOT_URL: "https://friendbot.internal.example",
    EXPLORER_BASE: "https://explorer.internal.example",
    SOROBAN_RPC_URL: "https://soroban.internal.example",
  });

  assert.equal(config.horizonUrl, "https://horizon.internal.example");
  assert.equal(config.friendbotUrl, "https://friendbot.internal.example");
  assert.equal(config.explorerBase, "https://explorer.internal.example");
  assert.equal(config.sorobanRpcUrl, "https://soroban.internal.example");
  // Overrides never change the selected network or its passphrase.
  assert.equal(config.network, "TESTNET");
  assert.equal(config.passphrase, StellarSdk.Networks.TESTNET);
});

test("resolveNetwork lets env URLs override the Futurenet defaults", () => {
  const config = resolveNetwork({
    NETWORK: "FUTURENET",
    HORIZON_URL: "https://horizon.internal.example",
    FRIENDBOT_URL: "https://friendbot.internal.example",
    EXPLORER_BASE: "https://explorer.internal.example",
    SOROBAN_RPC_URL: "https://soroban.internal.example",
  });

  assert.equal(config.network, "FUTURENET");
  assert.equal(config.passphrase, StellarSdk.Networks.FUTURENET);
  assert.equal(config.horizonUrl, "https://horizon.internal.example");
  assert.equal(config.explorerBase, "https://explorer.internal.example");
  assert.equal(config.sorobanRpcUrl, "https://soroban.internal.example");
  // Futurenet ships no Friendbot, so an explicit URL is the only way to get one.
  assert.equal(config.friendbotUrl, "https://friendbot.internal.example");
});

test("resolveNetwork ignores blank overrides instead of blanking a URL", () => {
  const config = resolveNetwork({
    NETWORK: "TESTNET",
    HORIZON_URL: "",
    FRIENDBOT_URL: "  ",
  });

  assert.equal(config.horizonUrl, "https://horizon-testnet.stellar.org");
  assert.equal(config.friendbotUrl, "https://friendbot.stellar.org");
});

test("resolveNetwork throws on an unsupported network", () => {
  assert.throws(
    () => resolveNetwork({ NETWORK: "MAINNET" }),
    (err) => {
      assert.match(err.message, /Unsupported NETWORK "MAINNET"/);
      assert.match(err.message, /TESTNET, FUTURENET/);
      return true;
    },
  );

  assert.throws(() => resolveNetwork({ NETWORK: "futurenet2" }), /Unsupported NETWORK/);
  assert.throws(() => resolveNetwork({ NETWORK: "PUBLIC" }), /Unsupported NETWORK/);
});

test("resolveNetwork advertises exactly the supported networks", () => {
  assert.deepEqual(SUPPORTED_NETWORKS, ["TESTNET", "FUTURENET"]);
  for (const network of SUPPORTED_NETWORKS) {
    assert.equal(resolveNetwork({ NETWORK: network }).network, network);
    assert.deepEqual(Object.keys(NETWORK_PRESETS[network]).sort(), [
      "explorerBase",
      "friendbotUrl",
      "horizonUrl",
      "label",
      "passphrase",
      "sorobanRpcUrl",
    ]);
  }
});

test("resolveNetwork returns a fresh object with preset defaults each call", () => {
  const overridden = resolveNetwork({
    NETWORK: "TESTNET",
    HORIZON_URL: "https://horizon.internal.example",
  });
  assert.equal(overridden.horizonUrl, "https://horizon.internal.example");

  const fresh = resolveNetwork({ NETWORK: "TESTNET" });
  assert.equal(fresh.horizonUrl, "https://horizon-testnet.stellar.org");
  assert.deepEqual(fresh, {
    network: "TESTNET",
    passphrase: StellarSdk.Networks.TESTNET,
    horizonUrl: "https://horizon-testnet.stellar.org",
    friendbotUrl: "https://friendbot.stellar.org",
    explorerBase: "https://stellar.expert/explorer/testnet",
    sorobanRpcUrl: "https://soroban-testnet.stellar.org",
  });
});
