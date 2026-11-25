import { describe, expect, it } from "vitest";
import { parseHorizonError } from "./horizonErrorParse";

describe("parseHorizonError - unknown result codes", () => {
  it("uses detail for unknown operation code when no known codes", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      detail: "Transaction failed due to unknown error",
      extras: {
        result_codes: {
          transaction: "tx_unknown_code",
          operations: ["op_unknown_code_xyz"],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.reason).toBe("Transaction failed due to unknown error");
    expect(result.resultCodes).toEqual(["tx_unknown_code", "op_unknown_code_xyz"]);
  });

  it("uses title when no detail for unknown code", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      title: "Transaction Failed",
      extras: {
        result_codes: {
          transaction: "tx_unknown_code",
          operations: ["op_unknown_code_xyz"],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.reason).toBe("Transaction Failed");
  });

  it("falls back to generic message when no detail/title", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      extras: {
        result_codes: {
          transaction: "tx_unknown_code",
          operations: ["op_unknown_code_xyz"],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.reason).toBe("Transaction failed (unknown reason).");
  });

  it("handles known operation code with unknown transaction code", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      extras: {
        result_codes: {
          transaction: "tx_unknown_code",
          operations: ["op_underfunded"],
        },
      },
    };

    const result = parseHorizonError(error);
    // Known operation code takes precedence
    expect(result.reason).toBe("Sending account does not have enough balance.");
  });
});