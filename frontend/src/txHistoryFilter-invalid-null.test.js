import { describe, expect, it } from "vitest";
import { filterTransactionHistory } from "./txHistoryFilter";

describe("filterTransactionHistory invalid records", () => {
  it("throws when records is null", () => {
    expect(() => filterTransactionHistory(null)).toThrow(TypeError);
  });
});
