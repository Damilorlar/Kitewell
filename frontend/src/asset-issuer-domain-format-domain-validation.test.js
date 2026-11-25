import { describe, expect, it } from "vitest";
import { formatAssetIssuerDomain } from "./assetIssuerDomainFormat";

const ISSUER = "GBEY3SZX2IQBPFMXIFPX3UR75OXF2IGUATURWN7BCBV23U226NY7EYFU";

describe("formatAssetIssuerDomain home domain validation", () => {
  it("lowercases the home domain", () => {
    expect(
      formatAssetIssuerDomain({ code: "USDC", issuer: ISSUER, domain: "Centre.IO" })
    ).toBe("USDC (centre.io)");
  });

  it("trims surrounding whitespace from the home domain", () => {
    expect(
      formatAssetIssuerDomain({ code: "USDC", issuer: ISSUER, domain: " centre.io " })
    ).toBe("USDC (centre.io)");
  });

  it("rejects a home domain without a top-level domain", () => {
    expect(() =>
      formatAssetIssuerDomain({ code: "USDC", issuer: ISSUER, domain: "centre" })
    ).toThrow("Asset home domain must include a top-level domain.");
  });

  it("rejects a home domain with an empty label", () => {
    expect(() =>
      formatAssetIssuerDomain({ code: "USDC", issuer: ISSUER, domain: "centre..io" })
    ).toThrow("Asset home domain contains an invalid label.");
  });

  it("rejects a home domain with a trailing dot", () => {
    expect(() =>
      formatAssetIssuerDomain({ code: "USDC", issuer: ISSUER, domain: "centre.io." })
    ).toThrow("Asset home domain contains an invalid label.");
  });

  it("rejects a label that starts with a hyphen", () => {
    expect(() =>
      formatAssetIssuerDomain({ code: "USDC", issuer: ISSUER, domain: "-centre.io" })
    ).toThrow("Asset home domain contains an invalid label.");
  });

  it("rejects a label that ends with a hyphen", () => {
    expect(() =>
      formatAssetIssuerDomain({ code: "USDC", issuer: ISSUER, domain: "centre-.io" })
    ).toThrow("Asset home domain contains an invalid label.");
  });

  it("rejects a label longer than 63 characters", () => {
    expect(() =>
      formatAssetIssuerDomain({
        code: "USDC",
        issuer: ISSUER,
        domain: `${"a".repeat(64)}.io`,
      })
    ).toThrow("Asset home domain contains an invalid label.");
  });

  it("rejects a top-level domain without a letter", () => {
    expect(() =>
      formatAssetIssuerDomain({ code: "USDC", issuer: ISSUER, domain: "centre.123" })
    ).toThrow("Asset home domain must end with a valid top-level domain.");
  });

  it("rejects a home domain longer than 253 characters", () => {
    const domain = `${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(62)}.io`;
    expect(() =>
      formatAssetIssuerDomain({ code: "USDC", issuer: ISSUER, domain })
    ).toThrow("Asset home domain cannot exceed 253 characters.");
  });
});
