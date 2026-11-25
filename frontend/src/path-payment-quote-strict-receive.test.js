import { describe, expect, it } from "vitest";
import { buildPathPaymentPayload } from "./pathPaymentQuote";

const DESTINATION = "GDESTINATION12345678901234567890123456789012345678901234";
const ISSUER_USDC = "GAWU5QOHUDUU7OHTZM3SSFZGXM3DEGNTTSPLHHT67WN2UVKCYNERQHEW";
const ISSUER_EUR = "GD7FLC7GH76D7A3NWZEGEOWM5GI6EAANS3QVEU4SDB7DCALCEMRWYLCS";

describe("buildPathPaymentPayload - strictReceive happy path", () => {
  it("builds strictReceive payload with native send asset and credit dest asset", () => {
    const formState = {
      mode: "strictReceive",
      sendAsset: { isNative: true },
      destAsset: { isNative: false, code: "USDC", issuer: ISSUER_USDC },
      amount: "25",
      sendMax: "26",
      path: "",
    };

    const payload = buildPathPaymentPayload(formState, DESTINATION);

    expect(payload.type).toBe("pathPaymentStrictReceive");
    expect(payload.sendAsset.isNative()).toBe(true);
    expect(payload.destAsset.getCode()).toBe("USDC");
    expect(payload.destAsset.getIssuer()).toBe(ISSUER_USDC);
    expect(payload.sendMax).toBe("26.0000000");
    expect(payload.destAmount).toBe("25.0000000");
    expect(payload.destination).toBe(DESTINATION);
    expect(payload.path).toHaveLength(0);
  });

  it("builds strictReceive payload with credit send asset and native dest asset", () => {
    const formState = {
      mode: "strictReceive",
      sendAsset: { isNative: false, code: "USDC", issuer: ISSUER_USDC },
      destAsset: { isNative: true },
      amount: "100",
      sendMax: "105",
      path: "",
    };

    const payload = buildPathPaymentPayload(formState, DESTINATION);

    expect(payload.type).toBe("pathPaymentStrictReceive");
    expect(payload.sendAsset.getCode()).toBe("USDC");
    expect(payload.sendAsset.getIssuer()).toBe(ISSUER_USDC);
    expect(payload.destAsset.isNative()).toBe(true);
    expect(payload.sendMax).toBe("105.0000000");
    expect(payload.destAmount).toBe("100.0000000");
  });

  it("builds strictReceive payload with intermediate path hops", () => {
    const formState = {
      mode: "strictReceive",
      sendAsset: { isNative: true },
      destAsset: { isNative: false, code: "USDC", issuer: ISSUER_USDC },
      amount: "25",
      sendMax: "26",
      path: `EUR:${ISSUER_EUR}, XLM`,
    };

    const payload = buildPathPaymentPayload(formState, DESTINATION);

    expect(payload.path).toHaveLength(2);
    expect(payload.path[0].getCode()).toBe("EUR");
    expect(payload.path[0].getIssuer()).toBe(ISSUER_EUR);
    expect(payload.path[1].isNative()).toBe(true);
  });

  it("normalizes amounts to 7 decimal places", () => {
    const formState = {
      mode: "strictReceive",
      sendAsset: { isNative: true },
      destAsset: { isNative: true },
      amount: "25",
      sendMax: "26",
    };

    const payload = buildPathPaymentPayload(formState, DESTINATION);

    expect(payload.destAmount).toBe("25.0000000");
    expect(payload.sendMax).toBe("26.0000000");
  });

  it("handles amounts with existing decimals correctly", () => {
    const formState = {
      mode: "strictReceive",
      sendAsset: { isNative: true },
      destAsset: { isNative: true },
      amount: "25.1234567",
      sendMax: "26.7654321",
    };

    const payload = buildPathPaymentPayload(formState, DESTINATION);

    expect(payload.destAmount).toBe("25.1234567");
    expect(payload.sendMax).toBe("26.7654321");
  });
});