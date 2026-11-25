import test from "node:test";
import assert from "node:assert/strict";

import {
  NetworkConfigError,
  resolveNetworkConfig,
} from "./networkConfigResolve.js";

test("resolveNetworkConfig rejects uppercase TESTNET", () => {
  assert.throws(
    () => resolveNetworkConfig("TESTNET"),
    (err) => {
      assert.ok(err instanceof NetworkConfigError);
      assert.equal(err.code, "unsupported_network");
      assert.equal(err.input, "TESTNET");
      return true;
    },
  );
});

test("resolveNetworkConfig rejects mixed-case and uppercase public names", () => {
  for (const name of ["Testnet", "PUBLIC", "Public", "TestNet"]) {
    assert.throws(
      () => resolveNetworkConfig(name),
      (err) => {
        assert.equal(err.code, "unsupported_network");
        assert.equal(err.input, name);
        return true;
      },
    );
  }
});

test("resolveNetworkConfig still accepts the exact lowercase names", () => {
  assert.equal(resolveNetworkConfig("testnet").horizonUrl.includes("testnet"), true);
  assert.equal(resolveNetworkConfig("public").friendbotUrl, null);
});
