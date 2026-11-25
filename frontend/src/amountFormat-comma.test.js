import { describe, expect, it } from "vitest";
import { toStroops } from "./amountFormat";

describe("amountFormat decimal comma", () => {
  it("accepts a comma as the decimal separator", () => {
    expect(toStroops("1,25")).toBe(12_500_000n);
  });
});