import { describe, expect, it } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import { NETWORKS } from "./network";

describe("network passphrases", () => {
  it("TESTNET passphrase matches SDK constant", () => {
    expect(NETWORKS.TESTNET.passphrase).toBe(StellarSdk.Networks.TESTNET);
  });

  it("FUTURENET passphrase matches SDK constant", () => {
    expect(NETWORKS.FUTURENET.passphrase).toBe(StellarSdk.Networks.FUTURENET);
  });
});
