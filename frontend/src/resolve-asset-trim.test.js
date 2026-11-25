import { describe, expect, it } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import { resolvePaymentAsset } from "./freighter";

describe("resolvePaymentAsset credit code normalization", () => {
  it("trims and uppercases the code without changing the issuer", () => {
    const issuer = StellarSdk.Keypair.random().publicKey();

    const asset = resolvePaymentAsset({
      isNative: false,
      code: " usdc ",
      issuer,
    });

    expect(asset.isNative()).toBe(false);
    expect(asset.getCode()).toBe("USDC");
    expect(asset.getIssuer()).toBe(issuer);
  });
});
