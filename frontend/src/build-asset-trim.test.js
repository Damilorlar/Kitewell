import { describe, expect, it } from "vitest";
import { buildAsset } from "./stellar";
import * as StellarSdk from "@stellar/stellar-sdk";

/**
 * Issue #81: lock credit-asset code normalization in buildAsset.
 *
 * stellar.test.js already covers the uppercase behavior for a bare `usdc`
 * code, but does not exercise surrounding whitespace. This suite locks the
 * trim + uppercase pipeline: a padded code like " usdc " must normalize to
 * "USDC" while the issuer is preserved as passed.
 */

describe("buildAsset code normalization", () => {
  it("trims and uppercases a padded credit-asset code", () => {
    const issuer = StellarSdk.Keypair.random().publicKey();

    const asset = buildAsset({ isNative: false, code: " usdc ", issuer });

    expect(asset.getCode()).toBe("USDC");
    expect(asset.getIssuer()).toBe(issuer);
  });
});
