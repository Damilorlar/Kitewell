import { describe, expect, it } from "vitest";
import { parseHorizonError } from "./horizonErrorParse";

describe("parseHorizonError - create account operation codes", () => {
  it("parses create account op_underfunded", () => {
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
    expect(result.reason).toBe("Sending account does not have enough balance.");
  });

  it("parses create account op_low_reserve", () => {
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

  it("parses create account op_already_exist", () => {
    const error = {
      type: "https://stellar.org/horizon-errors/transaction_failed",
      status: 400,
      extras: {
        result_codes: {
          transaction: "tx_failed",
          operations: ["op_already_exist"],
        },
      },
    };

    const result = parseHorizonError(error);
    expect(result.reason).toBe("Destination account already exists.");
  });
});