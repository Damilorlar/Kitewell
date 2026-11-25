import { describe, expect, it } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import { issuerTomlPresentation } from "./issuerToml";

const ISSUER = StellarSdk.Keypair.random().publicKey();
const EUR_ISSUER = StellarSdk.Keypair.random().publicKey();

function listing(overrides = {}) {
  return {
    homeDomain: "anchor.example.com",
    orgName: "Kitewell Anchor Ltd",
    documentation: { ORG_NAME: "Kitewell Anchor Ltd", ORG_URL: "https://kitewell.example" },
    rows: [
      { code: "USD", issuer: ISSUER, displayDecimals: 2 },
      { code: "EUR", issuer: EUR_ISSUER, displayDecimals: null },
    ],
    ...overrides,
  };
}

describe("issuerTomlPresentation", () => {
  it("leads with the domain it read and the org name", () => {
    const lines = issuerTomlPresentation(listing());
    expect(lines[0]).toBe("stellar.toml from anchor.example.com.");
    expect(lines[1]).toBe("Organisation: Kitewell Anchor Ltd.");
  });

  it("lists every DOCUMENTATION field it published", () => {
    const lines = issuerTomlPresentation(listing());
    expect(lines[2]).toBe("DOCUMENTATION (2 fields):");
    expect(lines[3]).toBe("  ORG_NAME = Kitewell Anchor Ltd");
    expect(lines[4]).toBe("  ORG_URL = https://kitewell.example");
  });

  it("says DOCUMENTATION is missing when the table is absent", () => {
    const lines = issuerTomlPresentation(listing({ documentation: {}, orgName: null }));
    expect(lines[1]).toBe("Organisation: not published.");
    expect(lines[2]).toBe("DOCUMENTATION is not published.");
  });

  it("counts one currency without pluralising wrongly", () => {
    const lines = issuerTomlPresentation(
      listing({ rows: [{ code: "USD", issuer: ISSUER, displayDecimals: 2 }] })
    );
    expect(lines).toContain("1 published currency:");
    expect(lines.at(-1)).toBe(`  USD · issuer ${ISSUER} · display_decimals 2`);
  });

  it("marks unpublished values instead of inventing them", () => {
    const lines = issuerTomlPresentation(
      listing({
        rows: [
          { code: null, issuer: null, displayDecimals: null },
          { code: "EUR", issuer: EUR_ISSUER, displayDecimals: null },
        ],
      })
    );
    expect(lines.at(-2)).toBe("  code not published · issuer not published · display_decimals not published");
    expect(lines.at(-1)).toBe(`  EUR · issuer ${EUR_ISSUER} · display_decimals not published`);
  });

  it("says so when the file publishes no currencies at all", () => {
    const lines = issuerTomlPresentation(listing({ rows: [] }));
    expect(lines.at(-1)).toBe("No CURRENCIES rows are published.");
    expect(lines.join("\n")).not.toContain("published currency");
  });

  it("keeps every line a string", () => {
    for (const line of issuerTomlPresentation(listing())) {
      expect(typeof line).toBe("string");
    }
  });
});
