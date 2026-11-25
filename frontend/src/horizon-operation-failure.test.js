import { describe, expect, it } from "vitest";
import { getTransactionFailure, parseTransactionFailure } from "./horizonErrorParse";

describe("parseTransactionFailure", () => {
  it("reports the zero-based operation index and known op_underfunded explanation", () => {
    const failure = parseTransactionFailure({
      type: "https://stellar.org/horizon-errors/transaction_failed",
      extras: {
        result_codes: {
          transaction: "tx_failed",
          operations: ["op_success", "op_underfunded"],
        },
      },
    });

    expect(failure).toEqual({
      operations: [
        {
          index: 1,
          code: "op_underfunded",
          explanation: "Sending account does not have enough balance.",
        },
      ],
      transactionCode: "tx_failed",
      transactionExplanation: "Transaction failed during execution.",
    });
  });

  it("keeps an unknown operation code without inventing an explanation", () => {
    const failure = parseTransactionFailure({
      result_codes: {
        operations: ["op_unknown_future_code"],
      },
    });

    expect(failure.operations).toEqual([
      { index: 0, code: "op_unknown_future_code", explanation: null },
    ]);
  });

  it("treats object prototype names as unknown result codes", () => {
    const failure = parseTransactionFailure({
      result_codes: {
        transaction: "constructor",
        operations: ["__proto__"],
      },
    });

    expect(failure.operations[0].explanation).toBeNull();
    expect(failure.transactionExplanation).toBeNull();
  });

  it("identifies a transaction-level failure when no operation result exists", () => {
    const failure = parseTransactionFailure({
      extras: { result_codes: { transaction: "tx_insufficient_fee" } },
    });

    expect(failure).toEqual({
      operations: [],
      transactionCode: "tx_insufficient_fee",
      transactionExplanation: "Transaction fee is below the network minimum.",
    });
  });

  it("extracts result codes from a submit error without exposing XDR", () => {
    const failure = getTransactionFailure({
      response: {
        data: {
          type: "https://stellar.org/horizon-errors/transaction_failed",
          extras: {
            result_codes: {
              transaction: "tx_failed",
              operations: ["op_underfunded"],
            },
            envelope_xdr: "signed secret xdr",
          },
        },
      },
    });

    expect(failure.operations[0].code).toBe("op_underfunded");
    expect(JSON.stringify(failure)).not.toContain("signed secret xdr");
  });
});
