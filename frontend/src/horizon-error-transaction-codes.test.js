import { describe, expect, it } from "vitest";
import { parseHorizonError } from "./horizonErrorParse";

describe("parseHorizonError - transaction-level result codes", () => {
  it("parses tx_bad_seq (sequence number issue)", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      extras: {
        result_codes: {
          transaction: "tx_bad_seq",
          operations: [],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.reason).toBe("Transaction sequence number is invalid (too low or too high).");
    expect(result.resultCodes).toEqual(["tx_bad_seq"]);
  });

  it("parses tx_bad_auth (authorization failed)", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      extras: {
        result_codes: {
          transaction: "tx_bad_auth",
          operations: [],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.reason).toBe("Transaction authorization failed (missing or invalid signatures).");
  });

  it("parses tx_insufficient_fee", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      extras: {
        result_codes: {
          transaction: "tx_insufficient_fee",
          operations: [],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.reason).toBe("Transaction fee is below the network minimum.");
  });

  it("parses tx_failed (generic failure)", () => {
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
    expect(result.reason).toBe("Transaction failed during execution.");
  });

  it("parses tx_internal_error", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 500,
      extras: {
        result_codes: {
          transaction: "tx_internal_error",
          operations: [],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.reason).toBe("Internal server error processing transaction.");
    expect(result.status).toBe(500);
  });

  it("parses tx_too_early", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      extras: {
        result_codes: {
          transaction: "tx_too_early",
          operations: [],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.reason).toBe("Transaction timebounds not yet reached.");
  });

  it("parses tx_too_late", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      extras: {
        result_codes: {
          transaction: "tx_too_late",
          operations: [],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.reason).toBe("Transaction timebounds expired.");
  });
});