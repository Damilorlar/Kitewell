import { Asset, Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { buildAssetKey } from "./assetKey";

describe("assetKey issued SDK Asset", () => {
  it("uses the issuer and code from a Stellar SDK asset", () => {
    const issuer = Keypair.random().publicKey();
    expect(buildAssetKey(new Asset("USDC", issuer))).toBe(`USDC:${issuer}`);
  });
});