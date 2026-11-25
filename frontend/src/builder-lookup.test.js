import { describe, expect, it, vi } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import {
  decodeBuilderName,
  describeBuilderLookup,
  lookupRegisteredBuilder,
  normalizeBuilderAddress,
} from "./builderLookup";

const REGISTERED = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const UNREGISTERED = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

/** Option<String>::Some(name) */
function someName(name) {
  return StellarSdk.nativeToScVal([name]);
}

/** Option<String>::None */
function noName() {
  return StellarSdk.nativeToScVal([]);
}

describe("normalizeBuilderAddress", () => {
  it("accepts a G… address and trims surrounding whitespace", () => {
    expect(normalizeBuilderAddress(`  ${REGISTERED}  `)).toBe(REGISTERED);
  });

  it("rejects anything that is not a Stellar public key before the call", () => {
    expect(() => normalizeBuilderAddress("")).toThrow(/public key/);
    expect(() => normalizeBuilderAddress("CAAAA")).toThrow(/public key/);
    expect(() => normalizeBuilderAddress(undefined)).toThrow(/public key/);
  });
});

describe("decodeBuilderName", () => {
  it("reads Some(name) and treats None as unregistered", () => {
    expect(decodeBuilderName(someName("stellar-alice"))).toBe("stellar-alice");
    expect(decodeBuilderName(noName())).toBeNull();
    expect(decodeBuilderName(null)).toBeNull();
  });
});

describe("lookupRegisteredBuilder", () => {
  it("shows the stored name for a registered builder", async () => {
    const simulate = vi.fn(async () => someName("stellar-alice"));

    const result = await lookupRegisteredBuilder(simulate, REGISTERED);

    expect(simulate).toHaveBeenCalledWith(REGISTERED);
    expect(result).toEqual({
      address: REGISTERED,
      name: "stellar-alice",
      registered: true,
      label: "stellar-alice",
    });
  });

  it("shows a clear message for an unregistered address", async () => {
    const simulate = vi.fn(async () => noName());

    const result = await lookupRegisteredBuilder(simulate, UNREGISTERED);

    expect(result.registered).toBe(false);
    expect(result.name).toBeNull();
    expect(result.label).toBe("Not registered");
  });

  it("does not call the contract when the address is invalid", async () => {
    const simulate = vi.fn();

    await expect(lookupRegisteredBuilder(simulate, "not-an-address")).rejects.toThrow(
      /public key/
    );
    expect(simulate).not.toHaveBeenCalled();
  });

  it("labels a builder whose stored name is blank as unregistered", () => {
    expect(describeBuilderLookup(REGISTERED, "   ").label).toBe("Not registered");
  });
});
