import { describe, expect, it } from "vitest";
import { createTxLog } from "./txLog";

describe("createTxLog", () => {
  it("records two successes and only the successful submissions", () => {
    const log = createTxLog();

    // The caller only records successful submits; the failed one is skipped.
    log.record({
      hash: "hash-one",
      operationType: "payment",
      network: "TESTNET",
      time: new Date("2026-11-20T10:00:00.000Z"),
    });
    log.record({
      hash: "hash-two",
      operationType: "pathPayment",
      network: "TESTNET",
      time: new Date("2026-11-20T10:01:00.000Z"),
    });

    expect(log.list()).toEqual([
      {
        hash: "hash-one",
        operationType: "payment",
        network: "TESTNET",
        time: "2026-11-20T10:00:00.000Z",
      },
      {
        hash: "hash-two",
        operationType: "pathPayment",
        network: "TESTNET",
        time: "2026-11-20T10:01:00.000Z",
      },
    ]);
  });

  it("stores the same hash once", () => {
    const log = createTxLog();

    log.record({ hash: "dup", operationType: "payment", network: "TESTNET" });
    log.record({ hash: "dup", operationType: "payment", network: "TESTNET" });

    expect(log.list()).toHaveLength(1);
  });

  it("exports JSON and clears the in-memory list", () => {
    const log = createTxLog({
      now: () => new Date("2026-11-20T12:00:00.000Z"),
    });

    log.record({ hash: "json-hash", operationType: "changeTrust", network: "TESTNET" });

    expect(JSON.parse(log.toJSON())).toEqual([
      {
        hash: "json-hash",
        operationType: "changeTrust",
        network: "TESTNET",
        time: "2026-11-20T12:00:00.000Z",
      },
    ]);

    log.clear();
    expect(log.list()).toEqual([]);
    expect(log.toJSON()).toBe("[]");
  });
});
