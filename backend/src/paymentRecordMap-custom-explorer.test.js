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

test("builds explorerUrl from a custom base without doubling slashes", () => {
  assert.equal(
    mapPaymentRecord(RECORD, { explorerBase: "https://example.org/explorer/" })
      .explorerUrl,
    "https://example.org/explorer/tx/deadbeef",
  );
});
