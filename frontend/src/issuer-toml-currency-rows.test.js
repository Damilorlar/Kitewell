import { describe, expect, it } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import { currencyRows, getOrgName, parseStellarToml } from "./issuerToml";

const ISSUER = StellarSdk.Keypair.random().publicKey();

function parsed(text) {
  return parseStellarToml(text);
}

describe("currencyRows", () => {
  it("keeps exactly the fields the issue asks the panel to show", () => {
    const rows = currencyRows(
      parsed(`[[CURRENCIES]]\ncode = "USD"\nissuer = "${ISSUER}"\ndisplay_decimals = 2\nname = "US Dollar"\nicon = "https://x/y.png"`)
    );
    expect(rows).toEqual([{ code: "USD", issuer: ISSUER, displayDecimals: 2 }]);
  });

  it("leaves unpublished fields null instead of inventing them", () => {
    const rows = currencyRows(parsed(`[[CURRENCIES]]\ncode = "USD"`));
    expect(rows).toEqual([{ code: "USD", issuer: null, displayDecimals: null }]);

    const bare = currencyRows(parsed("[[CURRENCIES]]"));
    expect(bare).toEqual([{ code: null, issuer: null, displayDecimals: null }]);
  });

  it("does not guess a decimal count from a non-number", () => {
    const rows = currencyRows(
      parsed(
        `[[CURRENCIES]]\ncode = "USD"\ndisplay_decimals = "2"\n[[CURRENCIES]]\ncode = "EUR"\ndisplay_decimals = 1.5\n[[CURRENCIES]]\ncode = "GBP"\ndisplay_decimals = true`
      )
    );
    expect(rows.map((row) => row.displayDecimals)).toEqual([null, 1.5, null]);
  });

  it("drops nothing: one output row per published row", () => {
    const rows = currencyRows(
      parsed(`[[CURRENCIES]]\ncode = "USD"\n[[CURRENCIES]]\n[[CURRENCIES]]\ncode = "EUR"`)
    );
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual({ code: null, issuer: null, displayDecimals: null });
  });

  it("reads no rows when the file publishes none", () => {
    expect(currencyRows(parsed('VERSION = "0.1"'))).toEqual([]);
    expect(currencyRows({})).toEqual([]);
    expect(currencyRows(null)).toEqual([]);
  });

  it("treats an empty or blank code as unpublished", () => {
    const rows = currencyRows(parsed(`[[CURRENCIES]]\ncode = ""\n[[CURRENCIES]]\ncode = 7`));
    expect(rows.map((row) => row.code)).toEqual([null, null]);
  });
});

describe("getOrgName", () => {
  it("reads the org name whichever spelling the issuer used", () => {
    for (const key of ["ORG_NAME", "ORGName", "Org_Name", "orgname"]) {
      expect(getOrgName(parsed(`[DOCUMENTATION]\n${key} = "Kitewell Anchor Ltd"`))).toBe(
        "Kitewell Anchor Ltd"
      );
    }
  });

  it("trims the published name", () => {
    expect(getOrgName(parsed('[DOCUMENTATION]\nORG_NAME = "  Kitewell  "'))).toBe("Kitewell");
  });

  it("returns null when nothing usable is published", () => {
    for (const body of [
      '[DOCUMENTATION]\nORG_NAME = "   "',
      "[DOCUMENTATION]\nORG_URL = \"https://kitewell.example\"",
      '[DOCUMENTATION]\nORG_NAME = 7',
      'VERSION = "0.1"',
    ]) {
      expect(getOrgName(parsed(body))).toBeNull();
    }
    expect(getOrgName({})).toBeNull();
    expect(getOrgName(null)).toBeNull();
  });
});
