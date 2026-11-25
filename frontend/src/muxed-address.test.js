import { describe, expect, it } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import { buildMuxedAddress, splitMuxedAddress } from "./addressFormat";

const BASE = StellarSdk.Keypair.random().publicKey();
const MAX_U64 = (1n << 64n) - 1n;

describe("buildMuxedAddress / splitMuxedAddress", () => {
  it("round-trips one id", () => {
    const muxed = buildMuxedAddress(BASE, "42");
    const decoded = splitMuxedAddress(muxed);

    expect(muxed.startsWith("M")).toBe(true);
    expect(decoded.gAddress).toBe(BASE);
    expect(decoded.id).toBe(42n);
  });

  it("allows id 0", () => {
    const decoded = splitMuxedAddress(buildMuxedAddress(BASE, 0));
    expect(decoded.gAddress).toBe(BASE);
    expect(decoded.id).toBe(0n);
  });

  it("accepts the maximum uint64 id", () => {
    const decoded = splitMuxedAddress(buildMuxedAddress(BASE, MAX_U64));
    expect(decoded.id).toBe(MAX_U64);
  });

  it("rejects an id past 2^64 - 1", () => {
    expect(() => buildMuxedAddress(BASE, MAX_U64 + 1n)).toThrow(/range/);
    expect(() =>
      buildMuxedAddress(BASE, "18446744073709551616")
    ).toThrow(/range/);
  });

  it("rejects non-integer ids", () => {
    expect(() => buildMuxedAddress(BASE, "1.5")).toThrow(/decimal integer/);
    expect(() => buildMuxedAddress(BASE, 1.5)).toThrow(/non-negative integer/);
    expect(() => buildMuxedAddress(BASE, "abc")).toThrow(/decimal integer/);
  });

  it("rejects invalid addresses", () => {
    expect(() => buildMuxedAddress("not-a-key", 1)).toThrow(/valid Stellar/);
    expect(() => splitMuxedAddress(BASE)).toThrow(/valid M/);
    expect(() => splitMuxedAddress("Mnotreal")).toThrow(/valid M/);
  });

  it("shows that the muxed payment still targets the base account", () => {
    const muxed = buildMuxedAddress(BASE, "7");

    // The M address decodes back to the same G account a payment credits.
    expect(splitMuxedAddress(muxed).gAddress).toBe(BASE);
    expect(StellarSdk.StrKey.isValidMed25519PublicKey(muxed)).toBe(true);
  });
});
