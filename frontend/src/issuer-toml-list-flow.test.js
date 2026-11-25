import { beforeEach, describe, expect, it, vi } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import { loadIssuerCurrencyList } from "./issuerToml";

const ISSUER = StellarSdk.Keypair.random().publicKey();
const EUR_ISSUER = StellarSdk.Keypair.random().publicKey();

const TOML = `# Kitewell anchor
[DOCUMENTATION]
ORG_NAME = "Kitewell Anchor Ltd"
ORG_URL = "https://kitewell.example"

[[CURRENCIES]]
code = "USD"
issuer = "${ISSUER}"
display_decimals = 2

[[CURRENCIES]]
code = "EUR"
issuer = "${EUR_ISSUER}"
`;

function tomlFetch(body = TOML) {
  return vi.fn(async (url) => ({
    ok: true,
    status: 200,
    url,
    text: async () => body,
  }));
}

describe("loadIssuerCurrencyList", () => {
  let fetchFn;
  let loadAccount;

  beforeEach(() => {
    fetchFn = tomlFetch();
    loadAccount = vi.fn(async () => ({ home_domain: "anchor.example.com" }));
  });

  it("starts from the account's home_domain", async () => {
    const result = await loadIssuerCurrencyList({
      accountOrDomain: ISSUER,
      loadAccount,
      fetchFn,
    });

    expect(loadAccount).toHaveBeenCalledWith(ISSUER);
    expect(fetchFn.mock.calls[0][0]).toBe(
      "https://anchor.example.com/.well-known/stellar.toml"
    );
    expect(result).toMatchObject({
      kind: "account",
      account: ISSUER,
      homeDomain: "anchor.example.com",
      orgName: "Kitewell Anchor Ltd",
    });
    expect(result.rows).toEqual([
      { code: "USD", issuer: ISSUER, displayDecimals: 2 },
      { code: "EUR", issuer: EUR_ISSUER, displayDecimals: null },
    ]);
  });

  it("accepts a domain typed straight in, with no ledger read", async () => {
    const result = await loadIssuerCurrencyList({
      accountOrDomain: "anchor.example.com",
      loadAccount,
      fetchFn,
    });

    expect(loadAccount).not.toHaveBeenCalled();
    expect(result.kind).toBe("domain");
    expect(result.account).toBeNull();
    expect(result.rows).toHaveLength(2);
  });

  it("publishes the whole DOCUMENTATION table it read", async () => {
    const result = await loadIssuerCurrencyList({
      accountOrDomain: "anchor.example.com",
      fetchFn,
    });
    expect(result.documentation).toEqual({
      ORG_NAME: "Kitewell Anchor Ltd",
      ORG_URL: "https://kitewell.example",
    });
    expect(result.currencies).toHaveLength(2);
  });

  it("shows the failure and no rows when the toml does not parse", async () => {
    fetchFn = tomlFetch('[DOCUMENTATION]\nORG_NAME = "Kitewell"\nbroken');
    await expect(
      loadIssuerCurrencyList({ accountOrDomain: "anchor.example.com", fetchFn })
    ).rejects.toThrow("stellar.toml line 3: a key is not followed by =");
  });

  it("reports an account that publishes no home_domain", async () => {
    loadAccount = vi.fn(async () => ({ home_domain: undefined }));
    await expect(
      loadIssuerCurrencyList({ accountOrDomain: ISSUER, loadAccount, fetchFn })
    ).rejects.toThrow(
      `The issuer account ${ISSUER} publishes no home_domain, so it has no stellar.toml.`
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("refuses an empty input before reading anything", async () => {
    for (const entered of ["", "   ", undefined, null, 42]) {
      await expect(
        loadIssuerCurrencyList({ accountOrDomain: entered, loadAccount, fetchFn })
      ).rejects.toThrow("Enter an issuer account or a home domain.");
    }
    expect(loadAccount).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("refuses an input that is neither an account nor a domain", async () => {
    await expect(
      loadIssuerCurrencyList({
        accountOrDomain: "https://anchor.example.com/toml",
        fetchFn,
      })
    ).rejects.toThrow("A home domain is a hostname, not a URL with a scheme.");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("carries the presentation lines with the parsed rows", async () => {
    const result = await loadIssuerCurrencyList({
      accountOrDomain: "anchor.example.com",
      fetchFn,
    });
    expect(result.presentation[0]).toBe("stellar.toml from anchor.example.com.");
    expect(result.presentation[1]).toBe("Organisation: Kitewell Anchor Ltd.");
    expect(result.presentation.join("\n")).toContain(`USD · issuer ${ISSUER} · display_decimals 2`);
    expect(result.presentation.join("\n")).toContain(
      `EUR · issuer ${EUR_ISSUER} · display_decimals not published`
    );
  });
});
