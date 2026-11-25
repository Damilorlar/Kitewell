import { describe, expect, it } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import { challengeRequestUrl } from "./sep10WebAuth";

const ACCOUNT = StellarSdk.Keypair.random().publicKey();
const OTHER = StellarSdk.Keypair.random().publicKey();
const ENDPOINT = "https://anchor.example.com/auth";

describe("challengeRequestUrl", () => {
  it("appends the connected account", () => {
    const url = new URL(challengeRequestUrl(ENDPOINT, { account: ACCOUNT }));
    expect(url.origin).toBe("https://anchor.example.com");
    expect(url.pathname).toBe("/auth");
    expect(url.searchParams.get("account")).toBe(ACCOUNT);
  });

  it("joins requested home domains with commas", () => {
    const url = new URL(
      challengeRequestUrl(ENDPOINT, {
        account: ACCOUNT,
        homeDomains: ["anchor.example.com", "shop.example.com"],
      })
    );
    expect(url.searchParams.get("home_domains")).toBe(
      "anchor.example.com,shop.example.com"
    );
  });

  it("drops blank and non-string home domains", () => {
    const url = new URL(
      challengeRequestUrl(ENDPOINT, {
        account: ACCOUNT,
        homeDomains: ["  ", "anchor.example.com", null, undefined, " spaced.example.com "],
      })
    );
    expect(url.searchParams.get("home_domains")).toBe(
      "anchor.example.com,spaced.example.com"
    );
  });

  it("leaves home_domains out when nothing was requested", () => {
    for (const homeDomains of [undefined, [], ["", "   "]]) {
      const url = new URL(challengeRequestUrl(ENDPOINT, { account: ACCOUNT, homeDomains }));
      expect(url.searchParams.has("home_domains")).toBe(false);
    }
  });

  it("reuses the endpoint normalisation rules", () => {
    expect(() => challengeRequestUrl("http://anchor.example.com/auth", { account: ACCOUNT })).toThrow(
      "The web-auth endpoint must use https://."
    );
    expect(() => challengeRequestUrl(ENDPOINT, { account: "GST7" })).toThrow(
      "Connect a valid Stellar account (G…) first."
    );
    expect(() => challengeRequestUrl(ENDPOINT, {})).toThrow(
      "Connect a valid Stellar account (G…) first."
    );
    expect(() => challengeRequestUrl(ENDPOINT, { account: OTHER })).not.toThrow();
  });

  it("keeps a path deeper than one segment", () => {
    const url = new URL(
      challengeRequestUrl("https://anchor.example.com/api/v2/web-auth", { account: ACCOUNT })
    );
    expect(url.pathname).toBe("/api/v2/web-auth");
    expect(url.searchParams.get("account")).toBe(ACCOUNT);
  });
});
