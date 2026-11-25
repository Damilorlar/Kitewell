import test from "node:test";
import assert from "node:assert/strict";

import { resolveNetworkConfig } from "./networkConfigResolve.js";
import { NetworkConfigError } from "./networkConfigResolveErrors.js";

test("resolveNetworkConfig rejects null and undefined", () => {
  assert.throws(
    () => resolveNetworkConfig(null),
    (err) => {
      assert.ok(err instanceof NetworkConfigError);
      assert.equal(err.code, "unsupported_network");
      assert.equal(err.input, null);
      assert.match(err.message, /null/);
      return true;
    },
  );

  assert.throws(
    () => resolveNetworkConfig(undefined),
    (err) => {
      assert.equal(err.code, "unsupported_network");
      assert.equal(err.input, undefined);
      return true;
    },
  );
});

test("resolveNetworkConfig rejects non-string inputs and keeps the original value", () => {
  const samples = [0, 1, false, true, 1n, { name: "testnet" }, ["testnet"]];

  for (const input of samples) {
    assert.throws(
      () => resolveNetworkConfig(input),
      (err) => {
        assert.equal(err.name, "NetworkConfigError");
        assert.equal(err.code, "unsupported_network");
        assert.equal(err.input, input);
        assert.equal(JSON.stringify(err.message).includes("SECRET"), false);
        return true;
      },
    );
  }
});

test("resolveNetworkConfig does not copy object fields into the error message", () => {
  const input = { passphrase: "super-secret-value", name: "testnet" };

  assert.throws(
    () => resolveNetworkConfig(input),
    (err) => {
      assert.equal(err.input, input);
      assert.equal(err.message.includes("super-secret-value"), false);
      return true;
    },
  );
});
