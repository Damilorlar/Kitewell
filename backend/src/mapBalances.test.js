import test from "node:test";
import assert from "node:assert/strict";

import { mapBalance, mapBalances } from "./mapBalances.js";

test("mapBalance maps a native XLM balance", () => {
  const result = mapBalance({
    asset_type: "native",
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

test("mapBalance maps a credit_alphanum4 asset balance", () => {
  const result = mapBalance({
    asset_type: "credit_alphanum4",
    asset_code: "USDC",
    asset_issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    balance: "123.4567890",
    limit: "1000000.0000000",
    is_authorized: true,
    is_authorized_to_maintain_liabilities: false,
    clawback_enabled: true,
  });

  assert.deepEqual(result, {
    key: "USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    code: "USDC",
    issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    balance: "123.4567890",
    limit: "1000000.0000000",
    isNative: false,
    isAuthorized: true,
    isAuthorizedToMaintainLiabilities: false,
    clawbackEnabled: true,
  });
});

test("mapBalance maps a credit_alphanum12 asset balance", () => {
  const result = mapBalance({
    asset_type: "credit_alphanum12",
    asset_code: "KITEWELLXLM",
    asset_issuer: "GDUKMGUGDZQK6YHYA5Z6AY2G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEX",
    balance: "0.1000000",
    limit: "922337203685.4775807",
  });

  assert.equal(result.key, "KITEWELLXLM:GDUKMGUGDZQK6YHYA5Z6AY2G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEX");
  assert.equal(result.code, "KITEWELLXLM");
  assert.equal(result.isNative, false);
});

test("mapBalances maps native and credit fixtures preserving order", () => {
  const result = mapBalances([
    { asset_type: "native", balance: "10.0000000" },
    {
      asset_type: "credit_alphanum4",
      asset_code: "USDC",
      asset_issuer: "GISSUER",
      balance: "5.0000000",
      limit: "1000.0000000",
    },
  ]);

  assert.equal(result.length, 2);
  assert.equal(result[0].isNative, true);
  assert.equal(result[1].isNative, false);
  assert.equal(result[1].code, "USDC");
});

test("mapBalances tolerates empty and malformed input", () => {
  assert.deepEqual(mapBalances([]), []);
  assert.deepEqual(mapBalances(null), []);
  assert.deepEqual(mapBalances(undefined), []);

  const result = mapBalances([null, { asset_type: "native", balance: "1.0000000" }, 7]);
  assert.equal(result.length, 1);
  assert.equal(result[0].key, "native");
});

test("mapBalance stores a missing credit limit as null", () => {
  const result = mapBalance({
    asset_type: "credit_alphanum4",
    asset_code: "USDC",
    asset_issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    balance: "1.0000000",
  });

  assert.equal(result.limit, null);
  assert.equal(result.code, "USDC");
});

test("mapBalance marks missing trustline flags as unknown", () => {
  const result = mapBalance({
    asset_type: "credit_alphanum4",
    asset_code: "USDC",
    asset_issuer: "GISSUER",
    balance: "1.0000000",
  });

  assert.equal(result.isAuthorized, null);
  assert.equal(result.isAuthorizedToMaintainLiabilities, null);
  assert.equal(result.clawbackEnabled, null);
});
