import { describe, expect, it } from "vitest";
import { formatAssetIssuerDomain } from "./assetIssuerDomainFormat";

const ISSUER = "GBEY3SZX2IQBPFMXIFPX3UR75OXF2IGUATURWN7BCBV23U226NY7EYFU";

describe("formatAssetIssuerDomain invalid input", () => {
  it("rejects an asset that is not an object", () => {
    expect(() => formatAssetIssuerDomain("USDC")).toThrow(TypeError);
    expect(() => formatAssetIssuerDomain(42)).toThrow(TypeError);
    expect(() => formatAssetIssuerDomain(null)).toThrow(TypeError);
    expect(() => formatAssetIssuerDomain([])).toThrow(TypeError);
  });

  it("rejects a code that is not a string", () => {
    expect(() => formatAssetIssuerDomain({ code: 42, issuer: ISSUER })).toThrow(
      TypeError
    );
  });

  it("rejects an issuer that is not a string", () => {
    expect(() => formatAssetIssuerDomain({ code: "USDC", issuer: 42 })).toThrow(
      TypeError
    );
  });

  it("rejects a home domain that is not a string", () => {
    expect(() =>
      formatAssetIssuerDomain({ code: "USDC", issuer: ISSUER, domain: 42 })
    ).toThrow(TypeError);
  });

  it("rejects a code with characters outside the alphanumeric set", () => {
    expect(() =>
      formatAssetIssuerDomain({ code: "US-DC", issuer: ISSUER })
    ).toThrow(/Asset code must be 1–12 alphanumeric characters/);
  });

  it("rejects a code longer than 12 characters", () => {
    expect(() =>
      formatAssetIssuerDomain({ code: "ABCDEFGHIJKLM", issuer: ISSUER })
    ).toThrow(/Asset code must be 1–12 alphanumeric characters/);
  });
});
