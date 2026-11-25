import { describe, expect, it } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import { currencyRows, getOrgName, parseStellarToml } from "./issuerToml";

const USD_ISSUER = StellarSdk.Keypair.random().publicKey();
const EUR_ISSUER = StellarSdk.Keypair.random().publicKey();

const TWO_CURRENCIES = `# Kitewell anchor publishing two assets
NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"
ACCOUNTS = ["${USD_ISSUER}", "${EUR_ISSUER}"]
VERSION = "0.1"

[DOCUMENTATION]
ORG_NAME = "Kitewell Anchor Ltd"
ORG_URL = "https://kitewell.example"
ORG_EMAIL = "anchors@kitewell.example"

[[CURRENCIES]]
code = "USD"
issuer = "${USD_ISSUER}"
display_decimals = 2
name = "US Dollar"

[[CURRENCIES]]
code = "EUR"
issuer = "${EUR_ISSUER}"
display_decimals = 7
`;

describe("parseStellarToml with two currencies", () => {
  it("keeps both CURRENCIES rows in file order", () => {
    const parsed = parseStellarToml(TWO_CURRENCIES);

    expect(parsed.arrays.CURRENCIES).toHaveLength(2);
    expect(currencyRows(parsed)).toEqual([
      { code: "USD", issuer: USD_ISSUER, displayDecimals: 2 },
      { code: "EUR", issuer: EUR_ISSUER, displayDecimals: 7 },
    ]);
  });

  it("reads the org name and the rest of DOCUMENTATION", () => {
    const parsed = parseStellarToml(TWO_CURRENCIES);

    expect(getOrgName(parsed)).toBe("Kitewell Anchor Ltd");
    expect(parsed.tables.DOCUMENTATION).toEqual({
      ORG_NAME: "Kitewell Anchor Ltd",
      ORG_URL: "https://kitewell.example",
      ORG_EMAIL: "anchors@kitewell.example",
    });
  });

  it("keeps top-level keys outside any table", () => {
    const parsed = parseStellarToml(TWO_CURRENCIES);

    expect(parsed.values.NETWORK_PASSPHRASE).toBe("Test SDF Network ; September 2015");
    expect(parsed.values.ACCOUNTS).toEqual([USD_ISSUER, EUR_ISSUER]);
    expect(parsed.values.VERSION).toBe("0.1");
  });

  it("ignores blank lines and whole-line comments", () => {
    const parsed = parseStellarToml(`
# a comment

VERSION = "0.2"   # a trailing comment
`);
    expect(parsed.values).toEqual({ VERSION: "0.2" });
  });

  it("returns no currencies for a file that publishes none", () => {
    const parsed = parseStellarToml('NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"');
    expect(currencyRows(parsed)).toEqual([]);
    expect(getOrgName(parsed)).toBeNull();
  });
});
