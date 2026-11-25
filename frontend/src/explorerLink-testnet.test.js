import { describe, expect, it } from "vitest";
import { buildTransactionExplorerUrl } from "./explorerLink";

describe("explorerLink testnet", () => {
  it("builds a transaction URL on Testnet", () => {
    expect(buildTransactionExplorerUrl("TESTNET", "a".repeat(64))).toBe(
      `https://stellar.expert/explorer/testnet/tx/${"a".repeat(64)}`
    );
  });
});