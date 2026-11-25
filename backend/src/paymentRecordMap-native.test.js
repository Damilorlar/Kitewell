import test from "node:test";
import assert from "node:assert/strict";

import { mapPaymentRecord } from "./paymentRecordMap.js";

test("maps a native XLM payment to the API shape", () => {
  const result = mapPaymentRecord({
    id: "1234567890",
    type: "payment",
    from: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    to: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    amount: "12.5000000",
    asset_type: "native",
    transaction_hash: "abc123hash",
    created_at: "2026-10-21T10:00:00Z",
  });

  assert.deepEqual(result, {
    id: "1234567890",
    from: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    to: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    amount: "12.5000000",
    asset_type: "native",
    asset_code: "XLM",
    transaction_hash: "abc123hash",
    created_at: "2026-10-21T10:00:00Z",
    explorerUrl: "https://stellar.expert/explorer/testnet/tx/abc123hash",
  });
});
