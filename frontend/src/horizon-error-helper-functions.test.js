import { describe, expect, it } from "vitest";
import { isTransactionFailedError, getOperationResultCodes, getTransactionResultCode } from "./horizonErrorParse";

describe("isTransactionFailedError", () => {
  it("returns true for transaction_failed type", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
    };
    expect(isTransactionFailedError(error)).toBe(true);
  });

  it("returns false for other error types", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/bad_request",
      status: 400,
    };
    expect(isTransactionFailedError(error)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isTransactionFailedError(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isTransactionFailedError(undefined)).toBe(false);
  });

  it("returns false for non-object", () => {
    expect(isTransactionFailedError("string")).toBe(false);
  });

  it("returns false for missing type", () => {
    const error = { status: 400 };
    expect(isTransactionFailedError(error)).toBe(false);
  });
});

describe("getOperationResultCodes", () => {
  it("returns operations array when present", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      extras: {
        result_codes: {
          transaction: "tx_failed",
          operations: ["op_underfunded", "op_no_trust"],
        },
      },
    };
    expect(getOperationResultCodes(error)).toEqual(["op_underfunded", "op_no_trust"]);
  });

  it("returns empty array when operations missing", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      extras: {
        result_codes: {
          transaction: "tx_failed",
        },
      },
    };
    expect(getOperationResultCodes(error)).toEqual([]);
  });

  it("returns empty array when result_codes missing", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      extras: {},
    };
    expect(getOperationResultCodes(error)).toEqual([]);
  });

  it("returns empty array when extras missing", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
    };
    expect(getOperationResultCodes(error)).toEqual([]);
  });

  it("returns empty array for null", () => {
    expect(getOperationResultCodes(null)).toEqual([]);
  });

  it("returns empty array for undefined", () => {
    expect(getOperationResultCodes(undefined)).toEqual([]);
  });
});

describe("getTransactionResultCode", () => {
  it("returns transaction code when present", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      extras: {
        result_codes: {
          transaction: "tx_bad_seq",
          operations: ["op_underfunded"],
        },
      },
    };
    expect(getTransactionResultCode(error)).toBe("tx_bad_seq");
  });

  it("returns null when transaction missing", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      extras: {
        result_codes: {
          operations: ["op_underfunded"],
        },
      },
    };
    expect(getTransactionResultCode(error)).toBeNull();
  });

  it("returns null when result_codes missing", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      extras: {},
    };
    expect(getTransactionResultCode(error)).toBeNull();
  });

  it("returns null when extras missing", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
    };
    expect(getTransactionResultCode(error)).toBeNull();
  });

  it("returns null for null", () => {
    expect(getTransactionResultCode(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(getTransactionResultCode(undefined)).toBeNull();
  });
});