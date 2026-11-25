import test from "node:test";
import assert from "node:assert/strict";

import { mapPaymentRecord } from "./paymentRecordMap.js";

test("keeps the asset code of a credit payment", () => {
  const result = mapPaymentRecord({
    id: "987",
    type: "payment",
    from: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    to: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    amount: "3.0000000",
    asset_type: "credit_alphanum4",
    asset_code: "USDC",
    asset_issuer: "GCISSUER",
    transaction_hash: "credit-hash",
    created_at: "2026-10-21T11:00:00Z",
  });

  assert.equal(result.asset_type, "credit_alphanum4");
  assert.equal(result.asset_code, "USDC");
  assert.equal(result.amount, "3.0000000");
  assert.equal(
    result.explorerUrl,
    "https://stellar.expert/explorer/testnet/tx/credit-hash",
  );
});
