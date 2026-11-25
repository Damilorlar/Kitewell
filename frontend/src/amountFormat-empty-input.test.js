import { describe, expect, it } from "vitest";
import { toStroops } from "./amountFormat";

describe("amountFormat empty input", () => {
  it("rejects empty or whitespace-only strings", () => {
    expect(() => toStroops("")).toThrow(RangeError);
    expect(() => toStroops("   ")).toThrow(RangeError);
  });
});