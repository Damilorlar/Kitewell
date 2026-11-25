import { describe, expect, it } from "vitest";
import { buildPathPaymentPayload, validatePathPaymentForm } from "./pathPaymentQuote";

const DESTINATION = "GDESTINATION12345678901234567890123456789012345678901234";

describe("buildPathPaymentPayload - mode edge cases", () => {
  const baseState = {
    sendAsset: { isNative: true },
    destAsset: { isNative: true },
    amount: "10",
  };

  it("rejects mode with wrong casing (StrictSend)", () => {
    const state = { ...baseState, mode: "StrictSend", destMin: "9" };
    expect(() => buildPathPaymentPayload(state, DESTINATION)).toThrow(
      "Unsupported path payment mode: StrictSend"
    );
  });

  it("rejects mode with wrong casing (StrictReceive)", () => {
    const state = { ...baseState, mode: "StrictReceive", sendMax: "11" };
    expect(() => buildPathPaymentPayload(state, DESTINATION)).toThrow(
      "Unsupported path payment mode: StrictReceive"
    );
  });

  it("rejects mode with extra whitespace", () => {
    const state = { ...baseState, mode: " strictSend ", destMin: "9" };
    expect(() => buildPathPaymentPayload(state, DESTINATION)).toThrow(
      "Unsupported path payment mode:  strictSend "
    );
  });

  it("rejects empty string mode", () => {
    const state = { ...baseState, mode: "", destMin: "9" };
    expect(() => buildPathPaymentPayload(state, DESTINATION)).toThrow(
      "Unsupported path payment mode: "
    );
  });

  it("validatePathPaymentForm rejects wrong casing", () => {
    const state = { ...baseState, mode: "StrictSend", destMin: "9" };
    const result = validatePathPaymentForm(state, DESTINATION);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Unsupported mode"))).toBe(true);
  });

  it("validatePathPaymentForm rejects empty mode", () => {
    const state = { ...baseState, mode: "", destMin: "9" };
    const result = validatePathPaymentForm(state, DESTINATION);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Unsupported mode"))).toBe(true);
  });
});