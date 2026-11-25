import { describe, expect, it } from "vitest";
import { sortBalances } from "./balanceSort";

describe("sortBalances null input", () => {
  it("throws when balances is null", () => {
    expect(() => sortBalances(null)).toThrow(TypeError);
  });
});
