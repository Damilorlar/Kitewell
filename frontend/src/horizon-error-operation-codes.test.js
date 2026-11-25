import { describe, expect, it } from "vitest";
import { parseHorizonError } from "./horizonErrorParse";

describe("parseHorizonError - transaction failed with operation codes", () => {
  it("parses op_underfunded (insufficient balance)", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      title: "Transaction Failed",
      status: 400,
      detail: "The transaction failed when submitted to the stellar network.",
      extras: {
        result_codes: {
          transaction: "tx_failed",
          operations: ["op_underfunded"],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.reason).toBe("Sending account does not have enough balance.");
    expect(result.resultCodes).toEqual(["tx_failed", "op_underfunded"]);
    expect(result.errorType).toBe("https://stellar.org/horizon-errors/transaction_failed");
    expect(result.status).toBe(400);
  });

  it("parses op_no_trust (missing trustline)", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      extras: {
        result_codes: {
          transaction: "tx_failed",
          operations: ["op_no_trust"],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.reason).toBe("Destination account does not trust the asset (missing trustline).");
    expect(result.resultCodes).toEqual(["tx_failed", "op_no_trust"]);
  });

  it("parses op_no_issuer (issuer does not exist)", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      extras: {
        result_codes: {
          transaction: "tx_failed",
          operations: ["op_no_issuer"],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.reason).toBe("Asset issuer does not exist.");
  });

  it("parses op_not_authorized (not authorized to hold asset)", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      extras: {
        result_codes: {
          transaction: "tx_failed",
          operations: ["op_not_authorized"],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.reason).toBe("Destination account is not authorized to hold the asset.");
  });

  it("parses op_line_full (trustline limit exceeded)", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      extras: {
        result_codes: {
          transaction: "tx_failed",
          operations: ["op_line_full"],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.reason).toBe("Destination account trustline limit would be exceeded.");
  });

  it("parses path payment op_no_path", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      extras: {
        result_codes: {
          transaction: "tx_failed",
          operations: ["op_no_path"],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.reason).toBe("No path found between source and destination assets.");
  });

  it("parses path payment op_too_few_offers", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      extras: {
        result_codes: {
          transaction: "tx_failed",
          operations: ["op_too_few_offers"],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.reason).toBe("Insufficient liquidity on the order book for the path.");
  });

  it("parses path payment op_under_destmin", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      extras: {
        result_codes: {
          transaction: "tx_failed",
          operations: ["op_under_destmin"],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.reason).toBe("Strict send path would receive less than destMin.");
  });

  it("parses path payment op_over_sendmax", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      extras: {
        result_codes: {
          transaction: "tx_failed",
          operations: ["op_over_sendmax"],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.reason).toBe("Strict receive path would exceed sendMax.");
  });
});