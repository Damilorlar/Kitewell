import { describe, expect, it } from "vitest";
import { buildPathPaymentPayload } from "./pathPaymentQuote";

const DESTINATION = "GDESTINATION12345678901234567890123456789012345678901234";

describe("buildPathPaymentPayload - missing required fields", () => {
  const baseState = {
    mode: "strictSend",
    sendAsset: { isNative: true },
    destAsset: { isNative: true },
    amount: "10",
    destMin: "9",
  };

  it("throws when mode is missing", () => {
    const state = { ...baseState };
    delete state.mode;
    expect(() => buildPathPaymentPayload(state, DESTINATION)).toThrow(
      "Unsupported path payment mode: undefined"
    );
  });

  it("throws when mode is invalid", () => {
    const state = { ...baseState, mode: "invalid" };
    expect(() => buildPathPaymentPayload(state, DESTINATION)).toThrow(
      "Unsupported path payment mode: invalid"
    );
  });

  it("throws when sendAsset is missing", () => {
    const state = { ...baseState };
    delete state.sendAsset;
    expect(() => buildPathPaymentPayload(state, DESTINATION)).toThrow(
      "Send asset is required."
    );
  });

  it("throws when sendAsset is empty object (treated as credit asset)", () => {
    const state = { ...baseState, sendAsset: {} };
    expect(() => buildPathPaymentPayload(state, DESTINATION)).toThrow(
      "Asset code is required for a credit asset."
    );
  });

  it("throws when destAsset is missing", () => {
    const state = { ...baseState };
    delete state.destAsset;
    expect(() => buildPathPaymentPayload(state, DESTINATION)).toThrow(
      "Destination asset is required."
    );
  });

  it("throws when destAsset is empty object (treated as credit asset)", () => {
    const state = { ...baseState, destAsset: {} };
    expect(() => buildPathPaymentPayload(state, DESTINATION)).toThrow(
      "Asset code is required for a credit asset."
    );
  });

  it("throws when amount is missing", () => {
    const state = { ...baseState };
    delete state.amount;
    expect(() => buildPathPaymentPayload(state, DESTINATION)).toThrow(
      "Amount is required."
    );
  });

  it("throws when amount is empty string", () => {
    const state = { ...baseState, amount: "" };
    expect(() => buildPathPaymentPayload(state, DESTINATION)).toThrow(
      "Amount is required."
    );
  });

  it("throws when amount is whitespace only", () => {
    const state = { ...baseState, amount: "   " };
    expect(() => buildPathPaymentPayload(state, DESTINATION)).toThrow(
      "Amount is required."
    );
  });

  it("throws when destination is missing", () => {
    expect(() => buildPathPaymentPayload(baseState, "")).toThrow(
      "Destination is required."
    );
  });

  it("throws when destination is whitespace only", () => {
    expect(() => buildPathPaymentPayload(baseState, "   ")).toThrow(
      "Destination is required."
    );
  });
});