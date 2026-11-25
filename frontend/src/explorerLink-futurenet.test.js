import { describe, expect, it } from "vitest";
import { buildTransactionExplorerUrl } from "./explorerLink";

describe("explorerLink Futurenet", () => {
  it("normalizes the network name and builds a Futurenet URL", () => {
    expect(buildTransactionExplorerUrl("futurenet", "b".repeat(64))).toBe(
      `https://stellar.expert/explorer/futurenet/tx/${"b".repeat(64)}`
    );
  });
});