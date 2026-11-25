import { describe, expect, it } from "vitest";
import { validatePaymentAmount } from "./validatePaymentAmount";

describe("validatePaymentAmount one stroop", () => {
  it("accepts the smallest positive amount", () => {
    expect(validatePaymentAmount("0.0000001")).toBe("0.0000001");
  });
});
