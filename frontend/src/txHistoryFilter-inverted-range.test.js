import { describe, expect, it } from "vitest";
import { filterTransactionHistory } from "./txHistoryFilter";

describe("filterTransactionHistory inverted range", () => {
  it("throws when from is later than to", () => {
    expect(() =>
      filterTransactionHistory([], { from: "2026-02-01T00:00:00Z", to: "2026-01-01T00:00:00Z" }),
    ).toThrow(RangeError);
  });
});
