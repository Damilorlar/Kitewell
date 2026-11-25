import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_EXPLORER_BASE,
  mapPaymentRecord,
} from "./paymentRecordMap.js";

test("preserves a 12-character asset code and a 7-decimal amount", () => {
  const result = mapPaymentRecord({
    id: "1",
    type: "payment",
    from: "GFROM",
    to: "GTO",
    amount: "0.0000007",
    asset_type: "credit_alphanum12",
    asset_code: "KITEWELLXLM",
    transaction_hash: "hash",
  });

  assert.equal(result.asset_code, "KITEWELLXLM");
  assert.equal(result.amount, "0.0000007");
  assert.equal(result.created_at, null);
});

test("falls back to the default explorer base for a blank option", () => {
  const result = mapPaymentRecord(
    {
      id: "1",
      type: "payment",
      from: "GFROM",
      to: "GTO",
      amount: "1.0000000",
      transaction_hash: "hash",
    },
    { explorerBase: "   " },
  );

  assert.equal(result.explorerUrl, `${DEFAULT_EXPLORER_BASE}/tx/hash`);
});
