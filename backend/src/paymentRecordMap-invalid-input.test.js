import test from "node:test";
import assert from "node:assert/strict";

import { mapPaymentRecord } from "./paymentRecordMap.js";

test("rejects non-object records with a TypeError", () => {
  for (const value of [null, undefined, "payment", 42, []]) {
    assert.throws(
      () => mapPaymentRecord(value),
      (err) =>
        err instanceof TypeError && err.message === "Payment record must be an object.",
    );
  }
});
