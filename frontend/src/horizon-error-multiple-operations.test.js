import { describe, expect, it } from "vitest";
import { parseHorizonError } from "./horizonErrorParse";

describe("parseHorizonError - multiple operation codes", () => {
  it("uses first recognized operation code for reason", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      extras: {
        result_codes: {
          transaction: "tx_failed",
          operations: ["op_no_trust", "op_underfunded"],
        },
      },
    };

    const result = parseHorizonError(error);
    // First recognized code should be used
    expect(result.reason).toBe("Destination account does not trust the asset (missing trustline).");
    expect(result.resultCodes).toEqual(["tx_failed", "op_no_trust", "op_underfunded"]);
  });

  it("includes all operation codes in resultCodes", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      extras: {
        result_codes: {
          transaction: "tx_failed",
          operations: ["op_underfunded", "op_no_trust", "op_line_full"],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.resultCodes).toEqual(["tx_failed", "op_underfunded", "op_no_trust", "op_line_full"]);
  });

  it("handles empty operations array", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      extras: {
        result_codes: {
          transaction: "tx_failed",
          operations: [],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.resultCodes).toEqual(["tx_failed"]);
  });

  it("handles single operation", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      extras: {
        result_codes: {
          transaction: "tx_failed",
          operations: ["op_underfunded"],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.resultCodes).toEqual(["tx_failed", "op_underfunded"]);
  });
});