import test from "node:test";
import assert from "node:assert/strict";

import { mapPaymentRecord } from "./paymentRecordMap.js";

const RECORD = {
  id: "1",
  type: "payment",
  from: "GFROM",
  to: "GTO",
  amount: "1.0000000",
  asset_type: "native",
  transaction_hash: "deadbeef",
};

test("rejects records missing a required string field", () => {
  const { transaction_hash: _hash, ...withoutHash } = RECORD;
  assert.throws(
    () => mapPaymentRecord(withoutHash),
    /Payment record is missing "transaction_hash"\./,
  );

  assert.throws(
    () => mapPaymentRecord({ ...RECORD, from: "   " }),
    /Payment record is missing "from"\./,
  );

  assert.throws(
    () => mapPaymentRecord({ ...RECORD, amount: 1 }),
    /Payment record is missing "amount"\./,
  );
});
