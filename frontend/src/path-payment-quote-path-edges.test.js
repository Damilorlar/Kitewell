import { describe, expect, it } from "vitest";
import { buildPathPaymentPayload } from "./pathPaymentQuote";

const DESTINATION = "GDESTINATION12345678901234567890123456789012345678901234";
const ISSUER = "GAWU5QOHUDUU7OHTZM3SSFZGXM3DEGNTTSPLHHT67WN2UVKCYNERQHEW";
const ISSUER2 = "GD7FLC7GH76D7A3NWZEGEOWM5GI6EAANS3QVEU4SDB7DCALCEMRWYLCS";

describe("buildPathPaymentPayload - path parsing edge cases", () => {
  const baseState = {
    mode: "strictSend",
    sendAsset: { isNative: true },
    destAsset: { isNative: true },
    amount: "10",
    destMin: "9",
  };

  it("parses path with multiple hops correctly", () => {
    const state = {
      ...baseState,
      path: `USDC:${ISSUER}, EUR:${ISSUER2}, XLM`,
    };

    const payload = buildPathPaymentPayload(state, DESTINATION);
    expect(payload.path).toHaveLength(3);
    expect(payload.path[0].getCode()).toBe("USDC");
    expect(payload.path[0].getIssuer()).toBe(ISSUER);
    expect(payload.path[1].getCode()).toBe("EUR");
    expect(payload.path[1].getIssuer()).toBe(ISSUER2);
    expect(payload.path[2].isNative()).toBe(true);
  });

  it("handles path with trailing comma", () => {
    const state = {
      ...baseState,
      path: `USDC:${ISSUER},`,
    };

    const payload = buildPathPaymentPayload(state, DESTINATION);
    expect(payload.path).toHaveLength(1);
  });

  it("handles path with leading comma", () => {
    const state = {
      ...baseState,
      path: `,USDC:${ISSUER}`,
    };

    const payload = buildPathPaymentPayload(state, DESTINATION);
    expect(payload.path).toHaveLength(1);
  });

  it("handles path with multiple consecutive commas", () => {
    const state = {
      ...baseState,
      path: `USDC:${ISSUER},,XLM`,
    };

    const payload = buildPathPaymentPayload(state, DESTINATION);
    expect(payload.path).toHaveLength(2);
  });

  it("returns correct payload structure for strictSend", () => {
    const state = { ...baseState, path: "" };
    const payload = buildPathPaymentPayload(state, DESTINATION);

    expect(payload).toHaveProperty("type", "pathPaymentStrictSend");
    expect(payload).toHaveProperty("sendAsset");
    expect(payload).toHaveProperty("sendAmount");
    expect(payload).toHaveProperty("destination", DESTINATION);
    expect(payload).toHaveProperty("destAsset");
    expect(payload).toHaveProperty("destMin");
    expect(payload).toHaveProperty("path");
    expect(Array.isArray(payload.path)).toBe(true);
  });

  it("returns correct payload structure for strictReceive", () => {
    const state = { ...baseState, mode: "strictReceive", sendMax: "11", path: "" };
    const payload = buildPathPaymentPayload(state, DESTINATION);

    expect(payload).toHaveProperty("type", "pathPaymentStrictReceive");
    expect(payload).toHaveProperty("sendAsset");
    expect(payload).toHaveProperty("sendMax");
    expect(payload).toHaveProperty("destination", DESTINATION);
    expect(payload).toHaveProperty("destAsset");
    expect(payload).toHaveProperty("destAmount");
    expect(payload).toHaveProperty("path");
    expect(Array.isArray(payload.path)).toBe(true);
  });

  it("preserves asset object types from buildAsset", () => {
    const state = {
      ...baseState,
      sendAsset: { isNative: false, code: "USDC", issuer: ISSUER },
      destAsset: { isNative: false, code: "EUR", issuer: ISSUER },
    };

    const payload = buildPathPaymentPayload(state, DESTINATION);

    // Check these are real SDK Asset objects with methods
    expect(typeof payload.sendAsset.isNative).toBe("function");
    expect(typeof payload.sendAsset.getCode).toBe("function");
    expect(typeof payload.sendAsset.getIssuer).toBe("function");
    expect(typeof payload.destAsset.isNative).toBe("function");
    expect(typeof payload.destAsset.getCode).toBe("function");
    expect(typeof payload.destAsset.getIssuer).toBe("function");

    expect(payload.sendAsset.getCode()).toBe("USDC");
    expect(payload.destAsset.getCode()).toBe("EUR");
  });
});