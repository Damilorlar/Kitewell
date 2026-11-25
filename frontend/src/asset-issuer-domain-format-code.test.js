import { describe, expect, it } from "vitest";
import { formatAssetIssuerDomain } from "./assetIssuerDomainFormat";

const ISSUER = "GBEY3SZX2IQBPFMXIFPX3UR75OXF2IGUATURWN7BCBV23U226NY7EYFU";

describe("formatAssetIssuerDomain asset codes", () => {
  it("uppercases a lowercase code", () => {
    expect(
      formatAssetIssuerDomain({ code: "usdc", issuer: ISSUER, domain: "centre.io" })
    ).toBe("USDC (centre.io)");
  });

  it("trims surrounding whitespace from the code", () => {
    expect(
      formatAssetIssuerDomain({ code: "  usdc  ", issuer: ISSUER, domain: "centre.io" })
    ).toBe("USDC (centre.io)");
  });

  it("keeps the issuer untouched when the code changes", () => {
    expect(formatAssetIssuerDomain({ code: "USD", issuer: ISSUER })).toBe(
      "USD (GBEY3S…Y7EYFU)"
    );
  });
});
