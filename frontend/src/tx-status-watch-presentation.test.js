import { describe, expect, it } from "vitest";
import { TX_STATUSES, txStatusPresentation } from "./txStatusWatch";

const HASH = "c".repeat(64);
const URL = `https://stellar.expert/explorer/testnet/tx/${HASH}`;

function snapshot({ status, code = null, operationCodes = [] } = {}) {
  return { hash: HASH, explorerUrl: URL, attempts: 3, status, code, operationCodes };
}

describe("txStatusPresentation", () => {
  it("says the transaction is still waiting", () => {
    expect(txStatusPresentation(snapshot({ status: "pending" }))).toEqual({
      status: "pending",
      text: "Waiting for the network to confirm this transaction.",
      explorerUrl: URL,
    });
  });

  it("says the transaction is on the ledger", () => {
    expect(txStatusPresentation(snapshot({ status: "success", code: "txSuccess" })).text).toBe(
      "The transaction is on the ledger."
    );
  });

  it("names the result code of a failed transaction", () => {
    expect(txStatusPresentation(snapshot({ status: "failed", code: "txBadSeq" })).text).toBe(
      "The transaction failed: txBadSeq."
    );
  });

  it("adds the first operation code when the transaction code is generic", () => {
    const shown = txStatusPresentation(
      snapshot({ status: "failed", code: "txFailed", operationCodes: ["opInner", "opUnderfunded"] })
    );

    expect(shown.text).toBe("The transaction failed: txFailed / opInner.");
  });

  it("still reads as a failure when Horizon sent no codes", () => {
    expect(txStatusPresentation(snapshot({ status: "failed" })).text).toBe(
      "The transaction failed."
    );
  });

  it("explains that an expired watch means the transaction never landed", () => {
    expect(txStatusPresentation(snapshot({ status: "expired" })).text).toBe(
      "Nothing reached the ledger before the transaction's max time, so it never landed."
    );
  });

  it("carries the explorer link through untouched", () => {
    for (const status of TX_STATUSES) {
      expect(txStatusPresentation(snapshot({ status })).explorerUrl).toBe(URL);
    }
  });

  it("has a line for every state the watch reports", () => {
    const lines = TX_STATUSES.map((status) => txStatusPresentation(snapshot({ status })).text);

    expect(lines).toHaveLength(TX_STATUSES.length);
    for (const line of lines) {
      expect(line).toMatch(/\.$/);
      expect(line.split("\n")).toHaveLength(1);
    }
  });

  it("refuses a state the watch never reports", () => {
    for (const status of ["unknown", "", undefined, null, "PENDING"]) {
      expect(() => txStatusPresentation(snapshot({ status }))).toThrow(
        `Unknown transaction status: ${status}`
      );
    }
  });

  it("refuses a snapshot with no status at all", () => {
    for (const value of [undefined, null, {}, { status: 42 }]) {
      expect(() => txStatusPresentation(value)).toThrow(/Unknown transaction status/);
    }
  });
});
