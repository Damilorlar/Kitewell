import { describe, expect, it } from "vitest";
import { buildPathPaymentPayload } from "./pathPaymentQuote";

const DESTINATION = "GDESTINATION12345678901234567890123456789012345678901234";

describe("buildPathPaymentPayload - missing/invalid form state", () => {
  it("throws when formState is undefined", () => {
    expect(() => buildPathPaymentPayload(undefined, DESTINATION)).toThrow(
      "Form state is required and must be an object."
    );
  });

  it("throws when formState is null", () => {
    expect(() => buildPathPaymentPayload(null, DESTINATION)).toThrow(
      "Form state is required and must be an object."
    );
  });

  it("throws when formState is not an object", () => {
    expect(() => buildPathPaymentPayload("not-an-object", DESTINATION)).toThrow(
      "Form state is required and must be an object."
    );
  });

  it("throws when formState is an array (has no mode property)", () => {
    expect(() => buildPathPaymentPayload([], DESTINATION)).toThrow(
      "Unsupported path payment mode: undefined"
    );
  });
});