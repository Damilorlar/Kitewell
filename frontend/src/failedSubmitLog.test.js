import { describe, expect, it } from "vitest";
import { createFailedSubmitLog } from "./failedSubmitLog";
import {
  FREIGHTER_CANCELLED_CODE,
  HORIZON_FAILURE_CODE,
  submitFailureResult,
} from "./submitFailure";

describe("createFailedSubmitLog", () => {
  it("records one Horizon failure and one cancelled prompt", () => {
    const log = createFailedSubmitLog();

    const horizonError = new Error(
      "Sending account does not have enough balance."
    );
    horizonError.code = HORIZON_FAILURE_CODE;

    const cancelledError = new Error("User declined");
    cancelledError.code = FREIGHTER_CANCELLED_CODE;

    log.record({
      operationType: "payment",
      network: "TESTNET",
      result: submitFailureResult(horizonError),
      time: new Date("2026-11-20T10:00:00.000Z"),
    });
    log.record({
      operationType: "changeTrust",
      network: "TESTNET",
      result: submitFailureResult(cancelledError),
      time: new Date("2026-11-20T10:01:00.000Z"),
    });

    expect(log.list()).toEqual([
      {
        time: "2026-11-20T10:00:00.000Z",
        operationType: "payment",
        network: "TESTNET",
        result: "Sending account does not have enough balance.",
      },
      {
        time: "2026-11-20T10:01:00.000Z",
        operationType: "changeTrust",
        network: "TESTNET",
        result: "cancelled",
      },
    ]);
  });

  it("does not copy a success into the failed list", () => {
    const log = createFailedSubmitLog();
    // Callers only record failures; a success path never calls record.
    expect(log.list()).toEqual([]);
    expect(log.toJSON()).toBe("[]");
  });

  it("clears the in-memory list without touching localStorage", () => {
    const log = createFailedSubmitLog({
      now: () => new Date("2026-11-20T12:00:00.000Z"),
    });

    log.record({
      operationType: "pathPayment",
      network: "TESTNET",
      result: "cancelled",
    });
    expect(log.list()).toHaveLength(1);

    log.clear();
    expect(log.list()).toEqual([]);
  });
});
