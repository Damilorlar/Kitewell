import { describe, expect, it } from "vitest";
import { filterTransactionHistory } from "./txHistoryFilter";

describe("filterTransactionHistory invalid date", () => {
  it("throws when created_at is not a date", () => {
    expect(() =>
      filterTransactionHistory([{ type: "payment", created_at: "yesterday" }], { from: "2026-01-01T00:00:00Z" }),
    ).toThrow(/created_at must be an ISO date string/);
  });
});
