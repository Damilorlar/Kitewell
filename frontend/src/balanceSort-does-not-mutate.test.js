import { describe, expect, it } from "vitest";
import { sortBalances } from "./balanceSort";

describe("sortBalances immutability", () => {
  it("does not mutate the input array", () => {
    const input = [
      { asset_type: "credit_alphanum4", asset_code: "ZZZ" },
      { asset_type: "native" },
    ];

    const sorted = sortBalances(input);

    expect(input.map((entry) => entry.asset_type)).toEqual(["credit_alphanum4", "native"]);
    expect(sorted).not.toBe(input);
    expect(sorted[0].asset_type).toBe("native");
  });
});
