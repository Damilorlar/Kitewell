import { describe, expect, it } from "vitest";
import { sortBalances } from "./balanceSort";

describe("sortBalances empty input", () => {
  it("returns an empty array", () => {
    expect(sortBalances([])).toEqual([]);
  });
});
