import { describe, expect, it } from "vitest";
import { formatAssetIssuerDomain } from "./assetIssuerDomainFormat";

const ISSUER = "GBEY3SZX2IQBPFMXIFPX3UR75OXF2IGUATURWN7BCBV23U226NY7EYFU";

describe("formatAssetIssuerDomain error cases", () => {
  it("throws when the code is missing", () => {
    expect(() => formatAssetIssuerDomain({ issuer: ISSUER })).toThrow(
      "Asset code is required."
    );
  });

  it("throws when the code is empty", () => {
    expect(() => formatAssetIssuerDomain({ code: "  ", issuer: ISSUER })).toThrow(
      "Asset code is required."
    );
  });

  it("throws when the issuer is missing", () => {
    expect(() => formatAssetIssuerDomain({ code: "USDC" })).toThrow(
      "Asset issuer is required."
    );
  });

  it("throws when the issuer is not a Stellar public key", () => {
    expect(() =>
      formatAssetIssuerDomain({ code: "USDC", issuer: "not-a-key" })
    ).toThrow("Asset issuer must be a valid Stellar public key (G…).");
  });

  it("throws when the issuer is too short to be a public key", () => {
    expect(() => formatAssetIssuerDomain({ code: "USDC", issuer: "GABC" })).toThrow(
      "Asset issuer must be a valid Stellar public key (G…)."
    );
  });

  it("throws when both shortening lengths are zero", () => {
    expect(() =>
      formatAssetIssuerDomain(
        { code: "USDC", issuer: ISSUER },
        { prefixLength: 0, suffixLength: 0 }
      )
    ).toThrow("prefixLength and suffixLength cannot both be 0.");
  });

  it("throws when a shortening length is negative", () => {
    expect(() =>
      formatAssetIssuerDomain(
        { code: "USDC", issuer: ISSUER },
        { prefixLength: -1 }
      )
    ).toThrow("prefixLength must be a non-negative integer.");
  });

  it("throws when a shortening length is not an integer", () => {
    expect(() =>
      formatAssetIssuerDomain(
        { code: "USDC", issuer: ISSUER },
        { suffixLength: 1.5 }
      )
    ).toThrow("suffixLength must be a non-negative integer.");
  });
});
