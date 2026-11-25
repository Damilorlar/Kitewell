import { describe, expect, it } from "vitest";
import { parseHorizonError } from "./horizonErrorParse";

describe("parseHorizonError - missing or empty extras/result_codes", () => {
  it("handles missing extras entirely", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      title: "Transaction Failed",
      status: 400,
      detail: "The transaction failed.",
    };

    const result = parseHorizonError(error);
    expect(result.reason).toBe("The transaction failed.");
    expect(result.resultCodes).toEqual([]);
    expect(result.errorType).toBe("https://stellar.org/horizon-errors/transaction_failed");
  });

  it("handles extras without result_codes", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      extras: {
        envelope_xdr: "AAAA...",
        result_xdr: "AAAA...",
      },
    };

    const result = parseHorizonError(error);
    expect(result.reason).toBe("Transaction failed (unknown reason).");
    expect(result.resultCodes).toEqual([]);
  });

  it("handles result_codes without transaction", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      extras: {
        result_codes: {
          operations: ["op_underfunded"],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.reason).toBe("Sending account does not have enough balance.");
    expect(result.resultCodes).toEqual(["op_underfunded"]);
  });

  it("handles result_codes with null transaction", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      extras: {
        result_codes: {
          transaction: null,
          operations: ["op_underfunded"],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.resultCodes).toEqual(["op_underfunded"]);
  });

  it("handles missing transaction code falls back to detail", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      detail: "Custom error detail from Horizon",
      extras: {
        result_codes: {
          operations: ["op_unknown_code"],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.reason).toBe("Custom error detail from Horizon");
    expect(result.resultCodes).toEqual(["op_unknown_code"]);
  });

  it("falls back to title when no detail", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      title: "Transaction Failed",
      extras: {
        result_codes: {
          operations: ["op_unknown_code"],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.reason).toBe("Transaction Failed");
  });
});