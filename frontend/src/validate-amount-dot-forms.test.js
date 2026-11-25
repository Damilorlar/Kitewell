import { describe, expect, it } from "vitest";
import { validatePaymentAmount } from "./validatePaymentAmount";

describe("validatePaymentAmount dot-edge forms", () => {
  it("rejects a leading-dot amount", () => {
    expect(() => validatePaymentAmount(".5")).toThrow(
      "Amount must be a positive number, e.g. 10 or 0.5."
    );
  });

  it("rejects a trailing-dot amount", () => {
    expect(() => validatePaymentAmount("5.")).toThrow(
      "Amount must be a positive number, e.g. 10 or 0.5."
    );
  });
});
