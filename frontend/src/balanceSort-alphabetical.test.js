import { describe, expect, it } from "vitest";
import { sortBalances } from "./balanceSort";

describe("sortBalances alphabetical codes", () => {
  it("orders issued assets by asset code", () => {
    const sorted = sortBalances([
      { asset_type: "credit_alphanum4", asset_code: "USD" },
      { asset_type: "credit_alphanum12", asset_code: "AQUA" },
      { asset_type: "credit_alphanum4", asset_code: "BTC" },
    ]);

    expect(sorted.map((entry) => entry.asset_code)).toEqual(["AQUA", "BTC", "USD"]);
  });
});
