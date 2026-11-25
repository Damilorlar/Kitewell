import { describe, expect, it } from "vitest";
import { formatIssuerWithDomain } from "./assetIssuerDomainFormat";

const ISSUER = "GBEY3SZX2IQBPFMXIFPX3UR75OXF2IGUATURWN7BCBV23U226NY7EYFU";

describe("formatIssuerWithDomain", () => {
  it("wraps a known home domain in parentheses", () => {
    expect(formatIssuerWithDomain(ISSUER, "centre.io")).toBe("(centre.io)");
  });

  it("falls back to the shortened issuer when no domain is given", () => {
    expect(formatIssuerWithDomain(ISSUER)).toBe("(GBEY3S…Y7EYFU)");
  });

  it("falls back to the shortened issuer when the domain is empty", () => {
    expect(formatIssuerWithDomain(ISSUER, "")).toBe("(GBEY3S…Y7EYFU)");
  });

  it("falls back to the shortened issuer when the domain is null", () => {
    expect(formatIssuerWithDomain(ISSUER, null)).toBe("(GBEY3S…Y7EYFU)");
  });

  it("passes the shortening options through to the fallback", () => {
    expect(
      formatIssuerWithDomain(ISSUER, undefined, { prefixLength: 4, suffixLength: 4 })
    ).toBe("(GBEY…EYFU)");
  });

  it("throws when the domain is invalid", () => {
    expect(() => formatIssuerWithDomain(ISSUER, "centre")).toThrow(
      "Asset home domain must include a top-level domain."
    );
  });

  it("throws when the issuer is invalid", () => {
    expect(() => formatIssuerWithDomain("not-a-key", "centre.io")).toThrow(
      "Asset issuer must be a valid Stellar public key (G…)."
    );
  });
});
