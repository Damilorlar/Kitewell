import { describe, expect, it } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import { resolvePaymentAsset } from "./freighter";

describe("resolvePaymentAsset maximum credit code length", () => {
  it("accepts a 12-character code and preserves its issuer", () => {
    const issuer = StellarSdk.Keypair.random().publicKey();
    const code = "ABCDEFGHIJKL";

    const asset = resolvePaymentAsset({ isNative: false, code, issuer });

    expect(asset.isNative()).toBe(false);
    expect(asset.getCode()).toBe(code);
    expect(asset.getIssuer()).toBe(issuer);
  });
});
