import { describe, expect, it } from "vitest";
import { formatAssetIssuerDomain, shortenIssuer } from "./assetIssuerDomainFormat";

const ISSUER = "GBEY3SZX2IQBPFMXIFPX3UR75OXF2IGUATURWN7BCBV23U226NY7EYFU";
const MAX_DOMAIN = `${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;

describe("formatAssetIssuerDomain boundary values", () => {
  it("accepts a code of exactly 12 characters", () => {
    expect(
      formatAssetIssuerDomain({
        code: "ABCDEFGHIJKL",
        issuer: ISSUER,
        domain: "centre.io",
      })
    ).toBe("ABCDEFGHIJKL (centre.io)");
  });

  it("accepts a code of exactly 1 character", () => {
    expect(
      formatAssetIssuerDomain({ code: "X", issuer: ISSUER, domain: "centre.io" })
    ).toBe("X (centre.io)");
  });

  it("returns the issuer unchanged when it exactly fits the kept lengths", () => {
    expect(shortenIssuer(ISSUER, { prefixLength: 56, suffixLength: 0 })).toBe(ISSUER);
    expect(
      formatAssetIssuerDomain(
        { code: "USDC", issuer: ISSUER },
        { prefixLength: 56, suffixLength: 0 }
      )
    ).toBe(`USDC (${ISSUER})`);
  });

  it("accepts a home domain of exactly 253 characters", () => {
    expect(MAX_DOMAIN).toHaveLength(253);
    expect(
      formatAssetIssuerDomain({ code: "USDC", issuer: ISSUER, domain: MAX_DOMAIN })
    ).toBe(`USDC (${MAX_DOMAIN})`);
  });

  it("accepts a home domain label of exactly 63 characters", () => {
    const domain = `${"a".repeat(63)}.io`;
    expect(
      formatAssetIssuerDomain({ code: "USDC", issuer: ISSUER, domain })
    ).toBe(`USDC (${domain})`);
  });
});
