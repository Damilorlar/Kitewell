import { describe, expect, it } from "vitest";
import { sortBalances } from "./balanceSort";

describe("sortBalances single native", () => {
  it("returns the only native balance unchanged", () => {
    const only = [{ asset_type: "native", balance: "0.0000000" }];
    expect(sortBalances(only)).toEqual(only);
  });
});
