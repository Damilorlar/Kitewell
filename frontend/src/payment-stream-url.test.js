import { describe, expect, it } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import { paymentsStreamUrl } from "./paymentStream";

const ACCOUNT = StellarSdk.Keypair.random().publicKey();
const HORIZON = "https://horizon-testnet.stellar.org";

describe("paymentsStreamUrl", () => {
  it("points at the account's payments endpoint", () => {
    const url = new URL(paymentsStreamUrl(HORIZON, ACCOUNT));
    expect(url.origin).toBe(HORIZON);
    expect(url.pathname).toBe(`/accounts/${ACCOUNT}/payments`);
  });

  it("starts from now so history is not replayed down the stream", () => {
    const url = new URL(paymentsStreamUrl(HORIZON, ACCOUNT));
    expect(url.searchParams.get("cursor")).toBe("now");
  });

  it("resumes from a cursor when the caller has one", () => {
    const url = new URL(
      paymentsStreamUrl(HORIZON, ACCOUNT, { cursor: "1700000000000-0" })
    );
    expect(url.searchParams.get("cursor")).toBe("1700000000000-0");
  });

  it("falls back to now for a blank cursor", () => {
    for (const cursor of ["", "   ", null, undefined]) {
      const url = new URL(paymentsStreamUrl(HORIZON, ACCOUNT, { cursor }));
      expect(url.searchParams.get("cursor")).toBe("now");
    }
  });

  it("caps the page size like the paged history call does", () => {
    const url = new URL(paymentsStreamUrl(HORIZON, ACCOUNT, { limit: 200 }));
    expect(url.searchParams.get("limit")).toBe("200");
    expect(new URL(paymentsStreamUrl(HORIZON, ACCOUNT)).searchParams.get("limit")).toBe("50");
  });

  it("tolerates a trailing slash on the Horizon URL", () => {
    expect(paymentsStreamUrl(`${HORIZON}/`, ACCOUNT)).toBe(paymentsStreamUrl(HORIZON, ACCOUNT));
  });

  it("uses the futurenet host when told to", () => {
    const url = paymentsStreamUrl("https://horizon-futurenet.stellar.org", ACCOUNT);
    expect(url.startsWith("https://horizon-futurenet.stellar.org/accounts/")).toBe(true);
  });

  it("refuses to build a stream for an account that is not connected", () => {
    for (const bad of ["", "GST7", undefined, null, 42]) {
      expect(() => paymentsStreamUrl(HORIZON, bad)).toThrow(
        "Connect a valid Stellar account (G…) first."
      );
    }
  });

  it("refuses a network with no Horizon host", () => {
    for (const bad of ["", "   ", undefined, null]) {
      expect(() => paymentsStreamUrl(bad, ACCOUNT)).toThrow(
        "There is no Horizon URL to stream payments from."
      );
    }
  });
});
