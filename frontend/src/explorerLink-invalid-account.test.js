import { describe, expect, it } from "vitest";
import { buildAccountExplorerUrl } from "./explorerLink";

describe("explorerLink invalid account ID", () => {
  it("rejects account identifiers outside the Stellar StrKey shape", () => {
    expect(() => buildAccountExplorerUrl("TESTNET", "Gnot-a-key")).toThrow(
      "Account ID must be a 56-character Stellar G... or C... ID."
    );
  });
});