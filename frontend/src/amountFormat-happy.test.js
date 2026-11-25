import { describe, expect, it } from "vitest";
import { formatStroops, toStroops } from "./amountFormat";

describe("amountFormat basic conversion", () => {
  it("converts a decimal amount to stroops and back", () => {
    expect(toStroops("12.3456789")).toBe(123_456_789n);
    expect(formatStroops(123_456_789n)).toBe("12.3456789");
  });
});