import { describe, expect, it } from "vitest";
import { validatePathPaymentForm } from "./pathPaymentQuote";

const DESTINATION = "GDESTINATION12345678901234567890123456789012345678901234";

describe("validatePathPaymentForm", () => {
  const validSendState = {
    mode: "strictSend",
    sendAsset: { isNative: true },
    destAsset: { isNative: true },
    amount: "10",
    destMin: "9",
  };

  const validReceiveState = {
    mode: "strictReceive",
    sendAsset: { isNative: true },
    destAsset: { isNative: true },
    amount: "25",
    sendMax: "26",
  };

  it("returns valid for correct strictSend form", () => {
    const result = validatePathPaymentForm(validSendState, DESTINATION);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns valid for correct strictReceive form", () => {
    const result = validatePathPaymentForm(validReceiveState, DESTINATION);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns invalid when formState is missing", () => {
    const result = validatePathPaymentForm(undefined, DESTINATION);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Form state is required.");
  });

  it("returns invalid when mode is invalid", () => {
    const result = validatePathPaymentForm({ ...validSendState, mode: "invalid" }, DESTINATION);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Unsupported mode"))).toBe(true);
  });

  it("returns invalid when sendAsset is missing", () => {
    const state = { ...validSendState };
    delete state.sendAsset;
    const result = validatePathPaymentForm(state, DESTINATION);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Send asset is required.");
  });

  it("returns invalid when destAsset is missing", () => {
    const state = { ...validSendState };
    delete state.destAsset;
    const result = validatePathPaymentForm(state, DESTINATION);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Destination asset is required.");
  });

  it("returns invalid when amount is missing", () => {
    const state = { ...validSendState };
    delete state.amount;
    const result = validatePathPaymentForm(state, DESTINATION);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Amount is required.");
  });

  it("returns invalid when destination is missing", () => {
    const result = validatePathPaymentForm(validSendState, "");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Destination is required.");
  });

  it("returns invalid when destMin is missing for strictSend", () => {
    const state = { ...validSendState };
    delete state.destMin;
    const result = validatePathPaymentForm(state, DESTINATION);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Minimum received (destMin) is required for strict send.");
  });

  it("returns invalid when sendMax is missing for strictReceive", () => {
    const state = { ...validReceiveState };
    delete state.sendMax;
    const result = validatePathPaymentForm(state, DESTINATION);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Maximum to send (sendMax) is required for strict receive.");
  });

  it("returns invalid with asset validation errors for sendAsset", () => {
    const state = {
      ...validSendState,
      sendAsset: { isNative: false, code: "USDC", issuer: "not-a-key" },
    };
    const result = validatePathPaymentForm(state, DESTINATION);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Send asset") && e.includes("valid Stellar public key"))).toBe(true);
  });

  it("returns invalid with asset validation errors for destAsset", () => {
    const state = {
      ...validSendState,
      destAsset: { isNative: false, code: "USDC", issuer: "not-a-key" },
    };
    const result = validatePathPaymentForm(state, DESTINATION);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Destination asset") && e.includes("valid Stellar public key"))).toBe(true);
  });

  it("returns invalid with multiple errors", () => {
    const result = validatePathPaymentForm({}, "");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });
});