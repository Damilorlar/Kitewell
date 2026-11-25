import { describe, expect, it } from "vitest";
import { filterTransactionHistory } from "./txHistoryFilter";

describe("filterTransactionHistory empty list", () => {
  it("returns an empty array", () => {
    expect(filterTransactionHistory([], { type: "payment" })).toEqual([]);
  });
});
