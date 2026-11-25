import { describe, expect, it } from "vitest";
import { formatStroops, toStroops } from "./amountFormat";

describe("amountFormat one-stroop boundary", () => {
  it("preserves the smallest representable XLM amount", () => {
    expect(toStroops("0.0000001")).toBe(1n);
    expect(formatStroops(1n)).toBe("0.0000001");
  });
});