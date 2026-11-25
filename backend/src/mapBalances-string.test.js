import test from "node:test";
import assert from "node:assert/strict";

import { mapBalance } from "./mapBalances.js";

/**
 * Balances are string amounts with seven decimal places. Converting them to
 * numbers would drop precision on small values, destroy trailing zeros, and
 * hand the frontend a value that cannot be rendered back to the original
 * string. These tests lock the string contract.
 */

test("mapBalance keeps a sub-unit native balance as the exact string", () => {
  const result = mapBalance({
    asset_type: "native",
    balance: "0.0000001",
  });

  assert.equal(result.balance, "0.0000001");
  assert.equal(typeof result.balance, "string");
});

test("mapBalance keeps trailing zeros on a native balance", () => {
  const result = mapBalance({
    asset_type: "native",
    balance: "1.0000000",
  });

  assert.equal(result.balance, "1.0000000");
  assert.equal(typeof result.balance, "string");
});

test("mapBalance keeps trailing zeros on a credit balance", () => {
  const result = mapBalance({
    asset_type: "credit_alphanum4",
    asset_code: "USDC",
    asset_issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    balance: "100.0000000",
    limit: "1000000.0000000",
  });

  assert.equal(result.balance, "100.0000000");
  assert.equal(typeof result.balance, "string");
});

test("mapBalance keeps a large credit balance string intact", () => {
  const result = mapBalance({
    asset_type: "credit_alphanum4",
    asset_code: "USDC",
    asset_issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    balance: "922337203685.4775807",
  });

  assert.equal(result.balance, "922337203685.4775807");
  assert.equal(typeof result.balance, "string");
});

test("mapBalance leaves the credit limit string untouched", () => {
  const result = mapBalance({
    asset_type: "credit_alphanum4",
    asset_code: "USDC",
    asset_issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    balance: "1.0000000",
    limit: "922337203685.4775807",
  });

  assert.equal(result.limit, "922337203685.4775807");
  assert.equal(typeof result.limit, "string");
});
