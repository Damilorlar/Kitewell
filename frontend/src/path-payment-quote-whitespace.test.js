import { describe, expect, it } from "vitest";
import { buildPathPaymentPayload } from "./pathPaymentQuote";

const DESTINATION = "GDESTINATION12345678901234567890123456789012345678901234";
const ISSUER = "GAWU5QOHUDUU7OHTZM3SSFZGXM3DEGNTTSPLHHT67WN2UVKCYNERQHEW";

describe("buildPathPaymentPayload - whitespace and normalization", () => {
  it("trims whitespace from amount in strictSend", () => {
    const formState = {
      mode: "strictSend",
      sendAsset: { isNative: true },
      destAsset: { isNative: true },
      amount: "  10  ",
      destMin: "  9  ",
    };

    const payload = buildPathPaymentPayload(formState, DESTINATION);
    expect(payload.sendAmount).toBe("10.0000000");
    expect(payload.destMin).toBe("9.0000000");
  });

  it("trims whitespace from amount in strictReceive", () => {
    const formState = {
      mode: "strictReceive",
      sendAsset: { isNative: true },
      destAsset: { isNative: true },
      amount: "  25  ",
      sendMax: "  26  ",
    };

    const payload = buildPathPaymentPayload(formState, DESTINATION);
    expect(payload.destAmount).toBe("25.0000000");
    expect(payload.sendMax).toBe("26.0000000");
  });

  it("handles tabs and newlines in path string", () => {
    const formState = {
      mode: "strictSend",
      sendAsset: { isNative: true },
      destAsset: { isNative: true },
      amount: "10",
      destMin: "9",
      path: `\tUSDC:${ISSUER}\n, XLM\t`,
    };

    const payload = buildPathPaymentPayload(formState, DESTINATION);
    expect(payload.path).toHaveLength(2);
    expect(payload.path[0].getCode()).toBe("USDC");
    expect(payload.path[1].isNative()).toBe(true);
  });

  it("uppercases asset codes in sendAsset", () => {
    const formState = {
      mode: "strictSend",
      sendAsset: { isNative: false, code: "usdc", issuer: ISSUER },
      destAsset: { isNative: true },
      amount: "10",
      destMin: "9",
    };

    const payload = buildPathPaymentPayload(formState, DESTINATION);
    expect(payload.sendAsset.getCode()).toBe("USDC");
  });

  it("uppercases asset codes in destAsset", () => {
    const formState = {
      mode: "strictSend",
      sendAsset: { isNative: true },
      destAsset: { isNative: false, code: "usdc", issuer: ISSUER },
      amount: "10",
      destMin: "9",
    };

    const payload = buildPathPaymentPayload(formState, DESTINATION);
    expect(payload.destAsset.getCode()).toBe("USDC");
  });

  it("uppercases asset codes in path", () => {
    const formState = {
      mode: "strictSend",
      sendAsset: { isNative: true },
      destAsset: { isNative: true },
      amount: "10",
      destMin: "9",
      path: `usdc:${ISSUER}`,
    };

    const payload = buildPathPaymentPayload(formState, DESTINATION);
    expect(payload.path[0].getCode()).toBe("USDC");
  });
});