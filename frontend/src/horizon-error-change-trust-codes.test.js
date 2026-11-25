import { describe, expect, it } from "vitest";
import { parseHorizonError } from "./horizonErrorParse";

describe("parseHorizonError - change trust operation codes", () => {
  it("parses op_low_reserve (insufficient reserve)", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      extras: {
        result_codes: {
          transaction: "tx_failed",
          operations: ["op_low_reserve"],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.reason).toBe("Account does not have enough reserve for a new trustline.");
  });

  it("parses op_invalid_limit", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      extras: {
        result_codes: {
          transaction: "tx_failed",
          operations: ["op_invalid_limit"],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.reason).toBe("Trustline limit is invalid.");
  });

  it("parses op_trust_not_allowed", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      extras: {
        result_codes: {
          transaction: "tx_failed",
          operations: ["op_trust_not_allowed"],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.reason).toBe("Asset does not allow trustlines (auth_required not set).");
  });
});