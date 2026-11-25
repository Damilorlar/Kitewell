import { describe, expect, it } from "vitest";
import { buildTransactionExplorerUrl } from "./explorerLink";

describe("explorerLink invalid network", () => {
  it("rejects unknown and missing network names", () => {
    expect(() => buildTransactionExplorerUrl("SANDBOX", "a".repeat(64))).toThrow(
      "Unsupported network: SANDBOX."
    );
    expect(() => buildTransactionExplorerUrl("", "a".repeat(64))).toThrow(
      "Network is required."
    );
  });
});