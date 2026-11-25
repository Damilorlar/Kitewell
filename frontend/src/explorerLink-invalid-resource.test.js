import { describe, expect, it } from "vitest";
import { buildExplorerUrl } from "./explorerLink";

describe("explorerLink invalid resource", () => {
  it("rejects unsupported explorer resource types", () => {
    expect(() => buildExplorerUrl("TESTNET", "ledger", "123")).toThrow(
      'Resource type must be "tx" or "account".'
    );
  });
});