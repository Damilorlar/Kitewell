import { describe, expect, it } from "vitest";
import { sortBalances } from "./balanceSort";

describe("sortBalances native first", () => {
  it("pins native XLM ahead of issued assets", () => {
    const sorted = sortBalances([
      { asset_type: "credit_alphanum4", asset_code: "USD" },
      { asset_type: "native", balance: "1.0000000" },
      { asset_type: "credit_alphanum4", asset_code: "AAA" },
    ]);

    expect(sorted.map((entry) => entry.asset_type)).toEqual(["native", "credit_alphanum4", "credit_alphanum4"]);
    expect(sorted[0].balance).toBe("1.0000000");
  });
});
