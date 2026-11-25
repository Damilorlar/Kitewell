import { describe, expect, it } from "vitest";
import { filterTransactionHistory } from "./txHistoryFilter";

describe("filterTransactionHistory no criteria", () => {
  it("returns every record without mutating the input", () => {
    const input = [{ id: "1", type: "payment" }, { id: "2", type: "create_account" }];
    const kept = filterTransactionHistory(input);

    expect(kept).toEqual(input);
    expect(kept).not.toBe(input);
    expect(input).toHaveLength(2);
  });
});
