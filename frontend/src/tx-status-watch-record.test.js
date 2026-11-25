import { describe, expect, it } from "vitest";
import { TX_STATUSES, txStatusFromRecord } from "./txStatusWatch";

const HASH = "f".repeat(64);

function record({ successful, result_codes } = {}) {
  const value = {
    hash: HASH,
    ledger: 2234567,
    created_at: "2026-11-21T12:00:00Z",
    fee_charged: "100",
    memo: "kitewell lab",
    envelope_xdr: "AAAA",
    result_xdr: "AAAA",
  };
  if (successful !== undefined) value.successful = successful;
  if (result_codes !== undefined) value.result_codes = result_codes;
  return value;
}

describe("txStatusFromRecord", () => {
  it("reports a successful ledger transaction as success", () => {
    expect(
      txStatusFromRecord(
        record({
          successful: true,
          result_codes: { transaction: "txSuccess", fee_charged: "100" },
        })
      )
    ).toEqual({ status: "success", code: "txSuccess", operationCodes: [] });
  });

  it("reports a failed transaction with the transaction-level code", () => {
    expect(
      txStatusFromRecord(
        record({ successful: false, result_codes: { transaction: "txBadSeq" } })
      )
    ).toEqual({ status: "failed", code: "txBadSeq", operationCodes: [] });
  });

  it("keeps the operation codes in Horizon's order", () => {
    const read = txStatusFromRecord(
      record({
        successful: false,
        result_codes: { transaction: "txFailed", operations: ["opInner", "opPaymentSuccess"] },
      })
    );

    expect(read.status).toBe("failed");
    expect(read.operationCodes).toEqual(["opInner", "opPaymentSuccess"]);
  });

  it("reports success even when the operations list is present", () => {
    const read = txStatusFromRecord(
      record({
        successful: true,
        result_codes: { transaction: "txSuccess", operations: ["opSuccess"] },
      })
    );

    expect(read).toEqual({ status: "success", code: "txSuccess", operationCodes: ["opSuccess"] });
  });

  it("still names the state when Horizon sent no result codes", () => {
    expect(txStatusFromRecord(record({ successful: false }))).toEqual({
      status: "failed",
      code: null,
      operationCodes: [],
    });
    expect(txStatusFromRecord(record({ successful: true }))).toEqual({
      status: "success",
      code: null,
      operationCodes: [],
    });
  });

  it("only a real true counts as success", () => {
    for (const successful of [false, undefined, null, 0, "true"]) {
      const read = txStatusFromRecord(record({ successful, result_codes: { transaction: "x" } }));
      expect(read.status).toBe("failed");
    }
  });

  it("refuses an operations value that is not a list", () => {
    expect(
      txStatusFromRecord(
        record({ successful: false, result_codes: { transaction: "txFailed", operations: "opInner" } })
      ).operationCodes
    ).toEqual([]);
  });

  it("never invents a state the watch does not report", () => {
    for (const value of [record({ successful: true }), record({ successful: false }), {}]) {
      expect(TX_STATUSES).toContain(txStatusFromRecord(value).status);
    }
  });

  it("returns exactly the three fields the panel reads", () => {
    expect(Object.keys(txStatusFromRecord(record({ successful: true })))).toEqual([
      "status",
      "code",
      "operationCodes",
    ]);
  });

  it("names the four states in the order a transaction moves through them", () => {
    expect(TX_STATUSES).toEqual(["pending", "success", "failed", "expired"]);
    expect(Object.isFrozen(TX_STATUSES)).toBe(true);
  });
});
