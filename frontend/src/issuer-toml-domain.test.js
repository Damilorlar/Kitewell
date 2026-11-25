import { describe, expect, it } from "vitest";
import { normaliseIssuerDomain, stellarTomlUrl } from "./issuerToml";

describe("normaliseIssuerDomain", () => {
  it("accepts a bare host and trims it", () => {
    expect(normaliseIssuerDomain(" anchor.example.com ")).toBe("anchor.example.com");
    expect(normaliseIssuerDomain("stellar.org")).toBe("stellar.org");
    expect(normaliseIssuerDomain("sub.domain.anchor.example")).toBe("sub.domain.anchor.example");
    expect(normaliseIssuerDomain("anchor-1.example.com")).toBe("anchor-1.example.com");
  });

  it("refuses a value that is not there", () => {
    for (const missing of [undefined, null, "", "   ", 42, {}]) {
      expect(() => normaliseIssuerDomain(missing)).toThrow("Enter the issuer's home domain.");
    }
  });

  it("refuses a domain with a scheme", () => {
    expect(() => normaliseIssuerDomain("https://anchor.example.com")).toThrow(
      "A home domain is a hostname, not a URL with a scheme."
    );
    expect(() => normaliseIssuerDomain("http://anchor.example.com")).toThrow(
      "A home domain is a hostname, not a URL with a scheme."
    );
    expect(() => normaliseIssuerDomain("ftp://anchor.example.com")).toThrow(
      "A home domain is a hostname, not a URL with a scheme."
    );
  });

  it("refuses a domain with a path, query or fragment", () => {
    for (const pathed of [
      "anchor.example.com/.well-known/stellar.toml",
      "anchor.example.com/",
      "anchor.example.com?x=1",
      "anchor.example.com#frag",
    ]) {
      expect(() => normaliseIssuerDomain(pathed)).toThrow(
        "A home domain cannot carry a path, query or fragment."
      );
    }
  });

  it("refuses a domain naming a port or embedding credentials", () => {
    expect(() => normaliseIssuerDomain("anchor.example.com:8443")).toThrow(
      "A home domain cannot name a port."
    );
    expect(() => normaliseIssuerDomain("user:pass@anchor.example.com")).toThrow(
      "A home domain cannot embed credentials."
    );
  });

  it("refuses whitespace inside the host and a host without a dot", () => {
    expect(() => normaliseIssuerDomain("anchor .example.com")).toThrow(
      "A home domain cannot contain spaces."
    );
    expect(() => normaliseIssuerDomain("localhost")).toThrow(
      "A home domain must be a hostname with at least one dot."
    );
    expect(() => normaliseIssuerDomain("anchor_example.com")).toThrow(
      "A home domain must be a hostname with at least one dot."
    );
    expect(() => normaliseIssuerDomain("-anchor.example.com")).toThrow(
      "A home domain must be a hostname with at least one dot."
    );
  });
});

describe("stellarTomlUrl", () => {
  it("always builds the well-known https URL", () => {
    expect(stellarTomlUrl("anchor.example.com")).toBe(
      "https://anchor.example.com/.well-known/stellar.toml"
    );
  });

  it("never produces an http URL", () => {
    for (const domain of ["anchor.example.com", "stellar.org", "a.b.c.example"]) {
      expect(stellarTomlUrl(domain).startsWith("https://")).toBe(true);
      expect(stellarTomlUrl(domain)).not.toMatch(/^http:/);
    }
  });

  it("applies the domain rules before building", () => {
    expect(() => stellarTomlUrl("https://anchor.example.com")).toThrow(
      "A home domain is a hostname, not a URL with a scheme."
    );
  });
});
