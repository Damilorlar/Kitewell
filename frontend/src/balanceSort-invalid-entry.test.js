import { describe, expect, it } from "vitest";
import { sortBalances } from "./balanceSort";

describe("sortBalances invalid entry", () => {
  it("throws when an entry is not an object", () => {
    expect(() => sortBalances(["native"])).toThrow(/each balance must be an object/);
  });
});
