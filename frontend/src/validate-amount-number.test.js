import { describe, expect, it } from "vitest";
import { validatePaymentAmount } from "./validatePaymentAmount";

describe("validatePaymentAmount numeric input", () => {
  it("stringifies a whole-number input", () => {
    expect(validatePaymentAmount(10)).toBe("10");
  });

  it("stringifies a fractional input", () => {
    expect(validatePaymentAmount(0.5)).toBe("0.5");
  });

  it("returns a string, not the original number", () => {
    expect(typeof validatePaymentAmount(10)).toBe("string");
    expect(typeof validatePaymentAmount(0.5)).toBe("string");
  });
});
