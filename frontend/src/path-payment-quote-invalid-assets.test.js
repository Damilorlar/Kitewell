import { describe, expect, it } from "vitest";
import { buildPathPaymentPayload } from "./pathPaymentQuote";

const DESTINATION = "GDESTINATION12345678901234567890123456789012345678901234";
const ISSUER = "GAWU5QOHUDUU7OHTZM3SSFZGXM3DEGNTTSPLHHT67WN2UVKCYNERQHEW";

describe("buildPathPaymentPayload - invalid asset descriptors", () => {
  const baseSendState = {
    mode: "strictSend",
    sendAsset: { isNative: true },
    destAsset: { isNative: true },
    amount: "10",
    destMin: "9",
  };

  it("throws when sendAsset code is missing for credit asset", () => {
    const state = {
      ...baseSendState,
      sendAsset: { isNative: false, issuer: ISSUER },
    };
    expect(() => buildPathPaymentPayload(state, DESTINATION)).toThrow(
      "Asset code is required for a credit asset."
    );
  });

  it("throws when sendAsset code is too long", () => {
    const state = {
      ...baseSendState,
      sendAsset: { isNative: false, code: "TOOLONGCODE123", issuer: ISSUER },
    };
    expect(() => buildPathPaymentPayload(state, DESTINATION)).toThrow(
      "Asset code must be 12 characters or fewer."
    );
  });

  it("throws when sendAsset issuer is invalid", () => {
    const state = {
      ...baseSendState,
      sendAsset: { isNative: false, code: "USDC", issuer: "not-a-key" },
    };
    expect(() => buildPathPaymentPayload(state, DESTINATION)).toThrow(
      "Asset issuer must be a valid Stellar public key (G…)."
    );
  });

  it("throws when destAsset code is missing for credit asset", () => {
    const state = {
      ...baseSendState,
      destAsset: { isNative: false, issuer: ISSUER },
    };
    expect(() => buildPathPaymentPayload(state, DESTINATION)).toThrow(
      "Asset code is required for a credit asset."
    );
  });

  it("throws when destAsset issuer is invalid", () => {
    const state = {
      ...baseSendState,
      destAsset: { isNative: false, code: "USDC", issuer: "not-a-key" },
    };
    expect(() => buildPathPaymentPayload(state, DESTINATION)).toThrow(
      "Asset issuer must be a valid Stellar public key (G…)."
    );
  });

  it("throws when path asset is missing issuer", () => {
    const state = {
      ...baseSendState,
      destMin: "9",
      path: "USDC",
    };
    expect(() => buildPathPaymentPayload(state, DESTINATION)).toThrow(
      /Path asset "USDC" needs an issuer/
    );
  });
});