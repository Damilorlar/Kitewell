import test from "node:test";
import assert from "node:assert/strict";

import { resolveNetworkConfig } from "./networkConfigResolve.js";
import { NetworkConfigError } from "./networkConfigResolveErrors.js";

test("resolveNetworkConfig rejects futurenet", () => {
  assert.throws(
    () => resolveNetworkConfig("futurenet"),
    (err) => {
      assert.ok(err instanceof NetworkConfigError);
      assert.equal(err.code, "unsupported_network");
      assert.equal(err.input, "futurenet");
      assert.match(err.message, /futurenet/);
      return true;
    },
  );
});

test("resolveNetworkConfig rejects unknown network names", () => {
  for (const name of ["mainnet", "local", "test", "pub"]) {
    assert.throws(
      () => resolveNetworkConfig(name),
      (err) => {
        assert.equal(err.name, "NetworkConfigError");
        assert.equal(err.code, "unsupported_network");
        assert.equal(err.input, name);
        assert.equal(err instanceof Error, true);
        return true;
      },
    );
  }
});

test("resolveNetworkConfig rejects names with surrounding spaces", () => {
  assert.throws(
    () => resolveNetworkConfig(" testnet"),
    (err) => err instanceof NetworkConfigError && err.input === " testnet",
  );
  assert.throws(
    () => resolveNetworkConfig("public "),
    (err) => err instanceof NetworkConfigError && err.input === "public ",
  );
});
