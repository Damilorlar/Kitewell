import { describe, expect, it } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import { resolvePaymentAsset } from "./freighter";

const ISSUER = StellarSdk.Keypair.random().publicKey();

describe("resolvePaymentAsset blank credit code", () => {
  it.each(["", "   "])("rejects %j instead of treating it as native", (code) => {
    expect(() =>
      resolvePaymentAsset({ isNative: false, code, issuer: ISSUER })
    ).toThrow("Asset code must be 1–12 characters.");
  });
});
