import { describe, expect, it } from "vitest";
import { toStroops } from "./amountFormat";

describe("amountFormat leading zeroes", () => {
  it("preserves the numeric value of a zero-padded amount", () => {
    expect(toStroops("0005.0200")).toBe(50_200_000n);
  });
});