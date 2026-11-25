import { describe, expect, it } from "vitest";
import { toStroops } from "./amountFormat";

describe("amountFormat whole XLM", () => {
  it("converts a whole amount without fractional digits", () => {
    expect(toStroops("5")).toBe(50_000_000n);
  });
});