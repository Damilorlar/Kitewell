import { describe, expect, it } from "vitest";
import { shortenIssuer } from "./assetIssuerDomainFormat";

const ISSUER = "GBEY3SZX2IQBPFMXIFPX3UR75OXF2IGUATURWN7BCBV23U226NY7EYFU";

describe("shortenIssuer", () => {
  it("keeps 6 characters from the start and 6 from the end by default", () => {
    expect(shortenIssuer(ISSUER)).toBe("GBEY3S…Y7EYFU");
  });

  it("honours custom prefix and suffix lengths", () => {
    expect(shortenIssuer(ISSUER, { prefixLength: 4, suffixLength: 4 })).toBe(
      "GBEY…EYFU"
    );
  });

  it("omits a zero-length suffix", () => {
    expect(shortenIssuer(ISSUER, { prefixLength: 6, suffixLength: 0 })).toBe(
      "GBEY3S…"
    );
  });

  it("omits a zero-length prefix", () => {
    expect(shortenIssuer(ISSUER, { prefixLength: 0, suffixLength: 4 })).toBe(
      "…EYFU"
    );
  });

  it("trims surrounding whitespace from the issuer", () => {
    expect(shortenIssuer(`  ${ISSUER}  `)).toBe("GBEY3S…Y7EYFU");
  });
});
