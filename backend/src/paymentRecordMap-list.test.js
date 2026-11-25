import test from "node:test";
import assert from "node:assert/strict";

import { mapPaymentRecords } from "./paymentRecordMap.js";

const payment = (id) => ({
  id,
  type: "payment",
  from: "GFROM",
  to: "GTO",
  amount: "1.0000000",
  asset_type: "native",
  transaction_hash: `hash-${id}`,
});

test("maps payment operations in order and drops other operations", () => {
  const result = mapPaymentRecords([
    payment("1"),
    { id: "2", type: "create_account", from: "GFROM", to: "GTO" },
    null,
    payment("3"),
  ]);

  assert.deepEqual(
    result.map((record) => record.id),
    ["1", "3"],
  );
  assert.equal(result[1].explorerUrl.endsWith("/tx/hash-3"), true);
});

test("returns an empty array for non-array input", () => {
  assert.deepEqual(mapPaymentRecords(null), []);
  assert.deepEqual(mapPaymentRecords(undefined), []);
  assert.deepEqual(mapPaymentRecords({}), []);
});
