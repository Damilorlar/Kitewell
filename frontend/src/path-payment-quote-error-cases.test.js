import { describe, expect, it } from "vitest";
import { buildPathPaymentPayload } from "./pathPaymentQuote";

const DESTINATION = "GDESTINATION12345678901234567890123456789012345678901234";
const ISSUER = "GAWU5QOHUDUU7OHTZM3SSFZGXM3DEGNTTSPLHHT67WN2UVKCYNERQHEW";

describe("buildPathPaymentPayload - error and edge cases", () => {
  it("throws descriptive error for empty form state object", () => {
    expect(() => buildPathPaymentPayload({}, DESTINATION)).toThrow(
      "Unsupported path payment mode: undefined"
    );
  });

  it("throws when sendAsset is null", () => {
    const formState = {
      mode: "strictSend",
      sendAsset: null,
      destAsset: { isNative: true },
      amount: "10",
      destMin: "9",
    };
    expect(() => buildPathPaymentPayload(formState, DESTINATION)).toThrow(
      "Send asset is required."
    );
  });

  it("throws when destAsset is null", () => {
    const formState = {
      mode: "strictSend",
      sendAsset: { isNative: true },
      destAsset: null,
      amount: "10",
      destMin: "9",
    };
    expect(() => buildPathPaymentPayload(formState, DESTINATION)).toThrow(
      "Destination asset is required."
    );
  });

  it("handles amount zero (normalization doesn't validate positivity)", () => {
    const formState = {
      mode: "strictSend",
      sendAsset: { isNative: true },
      destAsset: { isNative: true },
      amount: "0",
      destMin: "9",
    };
    const payload = buildPathPaymentPayload(formState, DESTINATION);
    expect(payload.sendAmount).toBe("0.0000000");
  });

  it("handles destMin greater than amount (user error, not our validation)", () => {
    const formState = {
      mode: "strictSend",
      sendAsset: { isNative: true },
      destAsset: { isNative: true },
      amount: "10",
      destMin: "20",
    };
    const payload = buildPathPaymentPayload(formState, DESTINATION);
    expect(payload.destMin).toBe("20.0000000");
    expect(payload.sendAmount).toBe("10.0000000");
  });

  it("handles sendMax less than amount (user error, not our validation)", () => {
    const formState = {
      mode: "strictReceive",
      sendAsset: { isNative: true },
      destAsset: { isNative: true },
      amount: "25",
      sendMax: "20",
    };
    const payload = buildPathPaymentPayload(formState, DESTINATION);
    expect(payload.destAmount).toBe("25.0000000");
    expect(payload.sendMax).toBe("20.0000000");
  });

  it("handles path with duplicate commas creating empty entries (filtered out)", () => {
    const formState = {
      mode: "strictSend",
      sendAsset: { isNative: true },
      destAsset: { isNative: true },
      amount: "10",
      destMin: "9",
      path: `USDC:${ISSUER},,XLM`,
    };
    const payload = buildPathPaymentPayload(formState, DESTINATION);
    expect(payload.path).toHaveLength(2);
  });

  it("throws when path entry has only code without issuer", () => {
    const formState = {
      mode: "strictSend",
      sendAsset: { isNative: true },
      destAsset: { isNative: true },
      amount: "10",
      destMin: "9",
      path: "USDC",
    };
    expect(() => buildPathPaymentPayload(formState, DESTINATION)).toThrow(
      /Path asset "USDC" needs an issuer/
    );
  });
});