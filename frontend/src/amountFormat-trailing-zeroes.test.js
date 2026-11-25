import { describe, expect, it } from "vitest";
import { formatStroops, toStroops } from "./amountFormat";

describe("amountFormat trailing zeroes", () => {
  it("parses and formats fractional trailing zeroes canonically", () => {
    expect(toStroops("1.2300000")).toBe(12_300_000n);
    expect(formatStroops(12_300_000n)).toBe("1.23");
  });
});