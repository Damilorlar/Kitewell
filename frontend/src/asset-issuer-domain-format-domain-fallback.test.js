import { describe, expect, it } from "vitest";
import { formatAssetIssuerDomain } from "./assetIssuerDomainFormat";

const ISSUER = "GBEY3SZX2IQBPFMXIFPX3UR75OXF2IGUATURWN7BCBV23U226NY7EYFU";

describe("formatAssetIssuerDomain without a known domain", () => {
  it("falls back to the shortened issuer", () => {
    expect(formatAssetIssuerDomain({ code: "USDC", issuer: ISSUER })).toBe(
      "USDC (GBEY3S…Y7EYFU)"
    );
  });

  it("falls back to the shortened issuer for an empty domain", () => {
    expect(
      formatAssetIssuerDomain({ code: "USDC", issuer: ISSUER, domain: "" })
    ).toBe("USDC (GBEY3S…Y7EYFU)");
  });

  it("falls back to the shortened issuer for a whitespace-only domain", () => {
    expect(
      formatAssetIssuerDomain({ code: "USDC", issuer: ISSUER, domain: "   " })
    ).toBe("USDC (GBEY3S…Y7EYFU)");
  });
});
