import { describe, expect, it } from "vitest";
import { buildAccountExplorerUrl } from "./explorerLink";

describe("explorerLink contract account", () => {
  it("accepts a contract ID with the Stellar StrKey alphabet", () => {
    const contractId = `C${"A".repeat(55)}`;
    expect(buildAccountExplorerUrl("TESTNET", contractId)).toContain(
      `/account/${contractId}`
    );
  });
});