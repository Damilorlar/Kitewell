import { describe, expect, it } from "vitest";
import { buildTransactionExplorerUrl } from "./explorerLink";

describe("explorerLink invalid transaction hash", () => {
  it("rejects malformed hashes", () => {
    expect(() => buildTransactionExplorerUrl("TESTNET", "not-a-hash")).toThrow(
      "Transaction hash must be 64 hexadecimal characters."
    );
  });
});