import { describe, expect, it } from "vitest";
import { validatePaymentAmount } from "./validatePaymentAmount";

describe("validatePaymentAmount", () => {
  it("returns the trimmed amount for valid values", () => {
    expect(validatePaymentAmount("10")).toBe("10");
    expect(validatePaymentAmount("0.5")).toBe("0.5");
    expect(validatePaymentAmount("  25.0000001  ")).toBe("25.0000001");
  });

  it("accepts the 7-decimal precision boundary", () => {
    expect(validatePaymentAmount("1.1234567")).toBe("1.1234567");
  });

  it("rejects empty input", () => {
    expect(() => validatePaymentAmount("")).toThrow(/required/);
    expect(() => validatePaymentAmount("   ")).toThrow(/required/);
    expect(() => validatePaymentAmount(null)).toThrow(/required/);
    expect(() => validatePaymentAmount(undefined)).toThrow(/required/);
  });

  it("rejects non-numeric input", () => {
    expect(() => validatePaymentAmount("abc")).toThrow(/positive number/);
    expect(() => validatePaymentAmount("1e3")).toThrow(/positive number/);
    expect(() => validatePaymentAmount("1,000")).toThrow(/positive number/);
    expect(() => validatePaymentAmount("-5")).toThrow(/positive number/);
    expect(() => validatePaymentAmount(".5")).toThrow(/positive number/);
    expect(() => validatePaymentAmount("1.")).toThrow(/positive number/);
  });

  it("rejects zero and negative-shaped zero", () => {
    expect(() => validatePaymentAmount("0")).toThrow(/greater than zero/);
    expect(() => validatePaymentAmount("0.0")).toThrow(/greater than zero/);
    expect(() => validatePaymentAmount("0.0000000")).toThrow(
      /greater than zero/
    );
  });

  it("rejects excessive precision", () => {
    expect(() => validatePaymentAmount("1.12345678")).toThrow(
      /at most 7 decimal places/
    );
  });

  it("uses the label in error messages", () => {
    expect(() => validatePaymentAmount("0", "XLM amount")).toThrow(
      /^XLM amount must be greater than zero\.$/
    );
  });
});
