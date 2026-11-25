import { describe, expect, it } from "vitest";
import { formatStroops, toStroops } from "./amountFormat";

describe("amountFormat invalid input", () => {
  it("rejects negative, ambiguous, imprecise, and unsafe inputs", () => {
    expect(() => toStroops("-1")).toThrow(RangeError);
    expect(() => toStroops("1,234.5")).toThrow(RangeError);
    expect(() => toStroops("1.00000001")).toThrow(RangeError);
    expect(() => toStroops(1.25)).toThrow(TypeError);
    expect(() => formatStroops(Number.MAX_SAFE_INTEGER + 1)).toThrow(TypeError);
  });
});