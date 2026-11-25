import { describe, expect, it } from "vitest";
import { accountLedgerStatus } from "./stellar";

describe("account ledger freshness", () => {
  it("marks an older account record as behind", () => {
    expect(accountLedgerStatus(120, 125)).toMatchObject({
      lastModifiedLedger: 120,
      latestLedger: 125,
      behindBy: 5,
      state: "behind",
    });
  });

  it("marks a matching account record as current", () => {
    expect(accountLedgerStatus(125, 125)).toMatchObject({
      behindBy: 0,
      state: "current",
    });
  });

  it("reports unknown age when either ledger is absent", () => {
    expect(accountLedgerStatus(null, 125).state).toBe("unknown");
    expect(accountLedgerStatus(125, undefined).state).toBe("unknown");
  });
});
