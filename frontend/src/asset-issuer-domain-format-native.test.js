import { describe, expect, it } from "vitest";
import { formatAssetIssuerDomain } from "./assetIssuerDomainFormat";

const ISSUER = "GBEY3SZX2IQBPFMXIFPX3UR75OXF2IGUATURWN7BCBV23U226NY7EYFU";

describe("formatAssetIssuerDomain native assets", () => {
  it("renders native XLM as the code alone", () => {
    expect(formatAssetIssuerDomain({ isNative: true })).toBe("XLM");
  });

  it("renders an explicit native code alone", () => {
    expect(formatAssetIssuerDomain({ isNative: true, code: "xlm" })).toBe("XLM");
  });

  it("defaults to XLM when a native asset has no code", () => {
    expect(formatAssetIssuerDomain({ isNative: true, code: null })).toBe("XLM");
  });

  it("ignores issuer and domain for native assets", () => {
    expect(
      formatAssetIssuerDomain({
        isNative: true,
        code: "XLM",
        issuer: ISSUER,
        domain: "centre.io",
      })
    ).toBe("XLM");
  });
});
