import { describe, expect, it } from "vitest";
import { buildPathPaymentPayload } from "./pathPaymentQuote";

const DESTINATION = "GDESTINATION12345678901234567890123456789012345678901234";

describe("buildPathPaymentPayload - missing bound fields", () => {
  const baseSendState = {
    mode: "strictSend",
    sendAsset: { isNative: true },
    destAsset: { isNative: true },
    amount: "10",
  };

  const baseReceiveState = {
    mode: "strictReceive",
    sendAsset: { isNative: true },
    destAsset: { isNative: true },
    amount: "25",
  };

  it("throws when destMin is missing for strictSend", () => {
    expect(() => buildPathPaymentPayload(baseSendState, DESTINATION)).toThrow(
      "Minimum received (destMin) is required."
    );
  });

  it("throws when destMin is empty string for strictSend", () => {
    const state = { ...baseSendState, destMin: "" };
    expect(() => buildPathPaymentPayload(state, DESTINATION)).toThrow(
      "Minimum received (destMin) is required."
    );
  });

  it("throws when destMin is whitespace for strictSend", () => {
    const state = { ...baseSendState, destMin: "   " };
    expect(() => buildPathPaymentPayload(state, DESTINATION)).toThrow(
      "Minimum received (destMin) is required."
    );
  });

  it("throws when sendMax is missing for strictReceive", () => {
    expect(() => buildPathPaymentPayload(baseReceiveState, DESTINATION)).toThrow(
      "Maximum to send (sendMax) is required."
    );
  });

  it("throws when sendMax is empty string for strictReceive", () => {
    const state = { ...baseReceiveState, sendMax: "" };
    expect(() => buildPathPaymentPayload(state, DESTINATION)).toThrow(
      "Maximum to send (sendMax) is required."
    );
  });

  it("throws when sendMax is whitespace for strictReceive", () => {
    const state = { ...baseReceiveState, sendMax: "   " };
    expect(() => buildPathPaymentPayload(state, DESTINATION)).toThrow(
      "Maximum to send (sendMax) is required."
    );
  });

  it("does not require sendMax for strictSend", () => {
    const state = { ...baseSendState, destMin: "9", sendMax: "100" };
    const payload = buildPathPaymentPayload(state, DESTINATION);
    expect(payload.type).toBe("pathPaymentStrictSend");
  });

  it("does not require destMin for strictReceive", () => {
    const state = { ...baseReceiveState, sendMax: "26", destMin: "24" };
    const payload = buildPathPaymentPayload(state, DESTINATION);
    expect(payload.type).toBe("pathPaymentStrictReceive");
  });
});