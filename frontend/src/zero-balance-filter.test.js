import { describe, expect, it } from "vitest";
import { filterVisibleBalances } from "./stellar";

describe("zero-balance credit asset visibility", () => {
  const balances = [
    { key: "native", isNative: true, balance: "0.0000000" },
    {
      key: "idle:issuer",
      isNative: false,
      balance: "0.0000000",
      buyingLiabilities: "0.0000000",
      sellingLiabilities: "0.0000000",
    },
    {
      key: "reserved:issuer",
      isNative: false,
      balance: "0.0000000",
      buyingLiabilities: "2.5000000",
      sellingLiabilities: "0.0000000",
    },
    { key: "held:issuer", isNative: false, balance: "3.0000000" },
  ];

  it("hides only idle zero credit lines and keeps XLM and liabilities", () => {
    expect(filterVisibleBalances(balances, true).map(({ key }) => key)).toEqual([
      "native",
      "reserved:issuer",
      "held:issuer",
    ]);
  });

  it("returns every balance when the preference is off", () => {
    expect(filterVisibleBalances(balances, false)).toEqual(balances);
  });
});
