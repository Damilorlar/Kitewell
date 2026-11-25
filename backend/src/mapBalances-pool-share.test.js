import test from "node:test";
import assert from "node:assert/strict";

import { mapBalance } from "./mapBalances.js";

test("mapBalance passes a liquidity pool share through with its pool id", () => {
  const result = mapBalance({
    asset_type: "liquidity_pool_shares",
    liquidity_pool_id: "abc123",
    balance: "12.5000000",
  });

  assert.deepEqual(result, {
    key: "pool:abc123",
    code: "POOL",
    issuer: null,
    balance: "12.5000000",
    limit: null,
    isNative: false,
    isPoolShare: true,
    poolId: "abc123",
  });
});
