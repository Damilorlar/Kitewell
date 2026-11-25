import { describe, expect, it } from "vitest";
import { buildAccountExplorerUrl } from "./explorerLink";

describe("explorerLink account", () => {
  it("builds a public account URL", () => {
    const accountId = `G${"A".repeat(55)}`;
    expect(buildAccountExplorerUrl("PUBLIC", accountId)).toBe(
      `https://stellar.expert/explorer/public/account/${accountId}`
    );
  });
});