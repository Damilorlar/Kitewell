import { describe, expect, it } from "vitest";
import { parseHorizonError } from "./horizonErrorParse";

describe("parseHorizonError - edge cases", () => {
  it("handles status as string (some APIs return string)", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: "400",
      extras: {
        result_codes: {
          transaction: "tx_failed",
          operations: ["op_underfunded"],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.status).toBe("400");
  });

  it("handles extras.result_codes.operations as null", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      extras: {
        result_codes: {
          transaction: "tx_failed",
          operations: null,
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.resultCodes).toEqual(["tx_failed"]);
  });

  it("handles extras.result_codes.operations as undefined", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      extras: {
        result_codes: {
          transaction: "tx_failed",
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.resultCodes).toEqual(["tx_failed"]);
  });

  it("handles empty object error response", () => {
    const error = {};
    const result = parseHorizonError(error);
    expect(result.reason).toBe("Transaction failed (unknown reason).");
    expect(result.resultCodes).toEqual([]);
    expect(result.errorType).toBe("");
    expect(result.status).toBe(0);
  });

  it("handles response with only type and status", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/not_found",
      status: 404,
    };

    const result = parseHorizonError(error);
    expect(result.reason).toBe("Transaction failed (unknown reason).");
    expect(result.status).toBe(404);
  });

  it("preserves all result codes in order (transaction first, then operations)", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      extras: {
        result_codes: {
          transaction: "tx_bad_seq",
          operations: ["op_underfunded", "op_no_trust", "op_line_full"],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.resultCodes).toEqual(["tx_bad_seq", "op_underfunded", "op_no_trust", "op_line_full"]);
  });
});