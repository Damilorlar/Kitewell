import { describe, expect, it } from "vitest";
import { buildPathPaymentPayload } from "./pathPaymentQuote";

const DESTINATION = "GDESTINATION12345678901234567890123456789012345678901234";
const ISSUER = "GAWU5QOHUDUU7OHTZM3SSFZGXM3DEGNTTSPLHHT67WN2UVKCYNERQHEW";

describe("buildPathPaymentPayload - boundary values", () => {
  it("handles minimum amount (1 stroop) for strictSend", () => {
    const formState = {
      mode: "strictSend",
      sendAsset: { isNative: true },
      destAsset: { isNative: true },
      amount: "0.0000001",
      destMin: "0.0000001",
    };

    const payload = buildPathPaymentPayload(formState, DESTINATION);
    expect(payload.sendAmount).toBe("0.0000001");
    expect(payload.destMin).toBe("0.0000001");
  });

  it("handles minimum amount (1 stroop) for strictReceive", () => {
    const formState = {
      mode: "strictReceive",
      sendAsset: { isNative: true },
      destAsset: { isNative: true },
      amount: "0.0000001",
      sendMax: "0.0000001",
    };

    const payload = buildPathPaymentPayload(formState, DESTINATION);
    expect(payload.destAmount).toBe("0.0000001");
    expect(payload.sendMax).toBe("0.0000001");
  });

  it("handles very large amounts (near u64 max in stroops)", () => {
    const formState = {
      mode: "strictSend",
      sendAsset: { isNative: true },
      destAsset: { isNative: true },
      amount: "922337203685.4775807",
      destMin: "922337203685.4775807",
    };

    const payload = buildPathPaymentPayload(formState, DESTINATION);
    expect(payload.sendAmount).toBe("922337203685.4775807");
    expect(payload.destMin).toBe("922337203685.4775807");
  });

  it("handles maximum asset code length (12 characters)", () => {
    const formState = {
      mode: "strictSend",
      sendAsset: { isNative: false, code: "ABCDEFGHIJKL", issuer: ISSUER },
      destAsset: { isNative: false, code: "MNOPQRSTUVWX", issuer: ISSUER },
      amount: "10",
      destMin: "9",
    };

    const payload = buildPathPaymentPayload(formState, DESTINATION);
    expect(payload.sendAsset.getCode()).toBe("ABCDEFGHIJKL");
    expect(payload.destAsset.getCode()).toBe("MNOPQRSTUVWX");
  });

  it("handles empty path (direct order book routing)", () => {
    const formState = {
      mode: "strictSend",
      sendAsset: { isNative: true },
      destAsset: { isNative: true },
      amount: "10",
      destMin: "9",
      path: "",
    };

    const payload = buildPathPaymentPayload(formState, DESTINATION);
    expect(payload.path).toHaveLength(0);
  });

  it("handles path with only whitespace", () => {
    const formState = {
      mode: "strictSend",
      sendAsset: { isNative: true },
      destAsset: { isNative: true },
      amount: "10",
      destMin: "9",
      path: "   ",
    };

    const payload = buildPathPaymentPayload(formState, DESTINATION);
    expect(payload.path).toHaveLength(0);
  });

  it("handles single native path hop", () => {
    const formState = {
      mode: "strictSend",
      sendAsset: { isNative: true },
      destAsset: { isNative: true },
      amount: "10",
      destMin: "9",
      path: "XLM",
    };

    const payload = buildPathPaymentPayload(formState, DESTINATION);
    expect(payload.path).toHaveLength(1);
    expect(payload.path[0].isNative()).toBe(true);
  });

  it("handles case-insensitive native in path", () => {
    const formState = {
      mode: "strictSend",
      sendAsset: { isNative: true },
      destAsset: { isNative: true },
      amount: "10",
      destMin: "9",
      path: "xlm, Native",
    };

    const payload = buildPathPaymentPayload(formState, DESTINATION);
    expect(payload.path).toHaveLength(2);
    expect(payload.path[0].isNative()).toBe(true);
    expect(payload.path[1].isNative()).toBe(true);
  });
});