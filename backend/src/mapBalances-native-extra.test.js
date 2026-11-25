import test from "node:test";
import assert from "node:assert/strict";

import { mapBalance, mapBalances } from "./mapBalances.js";

test("mapBalance ignores asset_issuer and limit on a native balance", () => {
  const result = mapBalance({
    asset_type: "native",
    asset_issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    limit: "1000000.0000000",
    balance: "42.5000000",
  });

  assert.deepEqual(result, {
    key: "native",
    code: "XLM",
    issuer: null,
    balance: "42.5000000",
    limit: null,
    isNative: true,
  });
});

test("mapBalances ignores asset_issuer and limit on native entries in a list", () => {
  const result = mapBalances([
    {
      asset_type: "native",
      asset_issuer: "GISSUER",
      limit: "1000.0000000",
      balance: "10.0000000",
    },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].key, "native");
  assert.equal(result[0].code, "XLM");
  assert.equal(result[0].issuer, null);
  assert.equal(result[0].limit, null);
  assert.equal(result[0].isNative, true);
});
