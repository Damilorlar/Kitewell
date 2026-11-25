import { describe, expect, it } from "vitest";
import { formatAssetIssuerDomain } from "./assetIssuerDomainFormat";

const ISSUER = "GBEY3SZX2IQBPFMXIFPX3UR75OXF2IGUATURWN7BCBV23U226NY7EYFU";

describe("formatAssetIssuerDomain happy path", () => {
  it("renders the code with the issuer home domain", () => {
    expect(
      formatAssetIssuerDomain({ code: "USDC", issuer: ISSUER, domain: "centre.io" })
    ).toBe("USDC (centre.io)");
  });

  it("renders the code with a home domain given through the alias", () => {
    expect(
      formatAssetIssuerDomain({ code: "EUR", issuer: ISSUER, homeDomain: "centre.io" })
    ).toBe("EUR (centre.io)");
  });

  it("uses the alias when the domain is missing", () => {
    expect(
      formatAssetIssuerDomain({ code: "EUR", issuer: ISSUER, domain: null, homeDomain: "centre.io" })
    ).toBe("EUR (centre.io)");
  });

  it("prefers the domain over the alias when both carry a value", () => {
    expect(
      formatAssetIssuerDomain({
        code: "EUR",
        issuer: ISSUER,
        domain: "centre.io",
        homeDomain: "other.example",
      })
    ).toBe("EUR (centre.io)");
  });
});
