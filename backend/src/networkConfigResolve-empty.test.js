import test from "node:test";
import assert from "node:assert/strict";

import { resolveNetworkConfig } from "./networkConfigResolve.js";
import { NetworkConfigError } from "./networkConfigResolveErrors.js";

test("resolveNetworkConfig rejects an empty string", () => {
  assert.throws(
    () => resolveNetworkConfig(""),
    (err) => {
      assert.ok(err instanceof NetworkConfigError);
      assert.equal(err.code, "unsupported_network");
      assert.equal(err.input, "");
      assert.match(err.message, /Unsupported network/);
      return true;
    },
  );
});

test("resolveNetworkConfig rejects whitespace-only names", () => {
  for (const name of [" ", "   ", "\t", "\n", " \t\n "]) {
    assert.throws(
      () => resolveNetworkConfig(name),
      (err) => {
        assert.equal(err.code, "unsupported_network");
        assert.equal(err.input, name);
        assert.equal(err.message.includes("secret"), false);
        return true;
      },
    );
  }
});
