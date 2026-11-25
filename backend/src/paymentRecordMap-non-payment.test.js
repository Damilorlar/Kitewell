import test from "node:test";
import assert from "node:assert/strict";

import { mapPaymentRecord } from "./paymentRecordMap.js";

test("rejects non-payment operations", () => {
  assert.throws(
    () =>
      mapPaymentRecord({
        id: "1",
        type: "create_account",
        from: "GFROM",
        to: "GTO",
        amount: "1.0000000",
        transaction_hash: "hash",
      }),
    /Unsupported operation type: create_account\./,
  );
});
