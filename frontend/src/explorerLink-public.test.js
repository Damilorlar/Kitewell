import { describe, expect, it } from "vitest";
import { buildTransactionExplorerUrl } from "./explorerLink";

describe("explorerLink Public network", () => {
  it("builds a transaction URL on the public network", () => {
    expect(buildTransactionExplorerUrl("PUBLIC", "c".repeat(64))).toBe(
      `https://stellar.expert/explorer/public/tx/${"c".repeat(64)}`
    );
  });
});