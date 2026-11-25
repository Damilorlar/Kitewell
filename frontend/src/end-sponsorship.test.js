import { describe, expect, it, vi } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import {
  buildRevokeSponsorshipTransaction,
  describeEndSponsorship,
  endSponsorshipWithFreighter,
  hasEndSponsorshipAction,
  identifySponsorshipEntry,
} from "./sponsorshipRevoke";

/**
 * Issue #668: one row of the sponsorship list ends that sponsorship with a
 * single revoke-sponsorship operation, and the confirmation names the
 * sponsored account and the entry.
 */

const SPONSOR = StellarSdk.Keypair.random().publicKey();
const SPONSORED = StellarSdk.Keypair.random().publicKey();
const ISSUER = StellarSdk.Keypair.random().publicKey();

/** A fixture trustline sponsorship row, as the list describes one. */
const TRUSTLINE_ROW = {
  sponsoredAccount: SPONSORED,
  entryType: "trustline",
  assetCode: "usdc",
  assetIssuer: ISSUER,
};

describe("identifySponsorshipEntry", () => {
  it("identifies a trustline sponsorship row", () => {
    expect(identifySponsorshipEntry(TRUSTLINE_ROW)).toMatchObject({
      entryType: "trustline",
      sponsoredAccount: SPONSORED,
      assetCode: "USDC",
      assetIssuer: ISSUER,
    });
  });

  it("refuses rows whose entry cannot be identified", () => {
    expect(identifySponsorshipEntry()).toBeNull();
    expect(
      identifySponsorshipEntry({ ...TRUSTLINE_ROW, sponsoredAccount: "G-not-a-key" })
    ).toBeNull();
    expect(identifySponsorshipEntry({ ...TRUSTLINE_ROW, entryType: "offer" })).toBeNull();
    expect(identifySponsorshipEntry({ ...TRUSTLINE_ROW, assetCode: "" })).toBeNull();
    expect(identifySponsorshipEntry({ ...TRUSTLINE_ROW, assetIssuer: "unknown" })).toBeNull();

    expect(hasEndSponsorshipAction(TRUSTLINE_ROW)).toBe(true);
    expect(hasEndSponsorshipAction({ ...TRUSTLINE_ROW, entryType: "offer" })).toBe(false);
  });
});

describe("describeEndSponsorship", () => {
  it("names the sponsored account and the entry in the confirmation", () => {
    const confirmation = describeEndSponsorship(TRUSTLINE_ROW);

    expect(confirmation.sponsoredAccount).toBe(SPONSORED);
    expect(confirmation.entryLabel).toBe(`USDC:${ISSUER} trustline`);
    expect(confirmation.message).toContain(SPONSORED);
    expect(confirmation.message).toContain(`USDC:${ISSUER}`);
    expect(confirmation.message).toContain("one revoke-sponsorship operation");
  });

  it("has no confirmation for an unidentifiable row", () => {
    expect(describeEndSponsorship({ entryType: "offer" })).toBeNull();
  });
});

describe("buildRevokeSponsorshipTransaction", () => {
  it("builds exactly one revoke operation for a fixture trustline sponsorship", () => {
    const transaction = buildRevokeSponsorshipTransaction({
      sponsor: SPONSOR,
      row: TRUSTLINE_ROW,
      sequence: "7",
    });

    expect(transaction.operations).toHaveLength(1);
    expect(transaction.source).toBe(SPONSOR);

    const [operation] = transaction.operations;
    expect(operation.type).toBe("revokeTrustlineSponsorship");
    expect(operation.account).toBe(SPONSORED);
    expect(operation.asset).toEqual({ code: "USDC", issuer: ISSUER });
  });

  it("refuses an unidentifiable row instead of guessing an entry", () => {
    expect(() =>
      buildRevokeSponsorshipTransaction({
        sponsor: SPONSOR,
        row: { sponsoredAccount: SPONSORED, entryType: "offer", offerId: "9" },
      })
    ).toThrow(/cannot be identified/);
  });

  it("does not sign while building", () => {
    const transaction = buildRevokeSponsorshipTransaction({
      sponsor: SPONSOR,
      row: TRUSTLINE_ROW,
    });

    expect(transaction.signatures).toHaveLength(0);
  });
});

describe("endSponsorshipWithFreighter", () => {
  function horizonStub() {
    return {
      loadAccount: vi
        .fn()
        .mockResolvedValue(new StellarSdk.Account(SPONSOR, "7")),
      submitTransaction: vi.fn().mockImplementation(async (transaction) => ({
        hash: transaction.hash().toString("hex"),
      })),
    };
  }

  it("signs the revoke transaction and submits it once", async () => {
    const server = horizonStub();
    const signer = StellarSdk.Keypair.random();
    const sign = vi.fn(async (xdr) => {
      const transaction = StellarSdk.TransactionBuilder.fromXDR(
        xdr,
        StellarSdk.Networks.TESTNET
      );
      transaction.sign(signer);
      return { signedTxXdr: transaction.toXDR() };
    });

    const result = await endSponsorshipWithFreighter(SPONSOR, TRUSTLINE_ROW, {
      server,
      sign,
    });

    expect(sign).toHaveBeenCalledTimes(1);
    expect(server.submitTransaction).toHaveBeenCalledTimes(1);
    const submitted = server.submitTransaction.mock.calls[0][0];
    expect(submitted.operations).toHaveLength(1);
    expect(submitted.operations[0].type).toBe("revokeTrustlineSponsorship");
    expect(result).toMatchObject({
      sponsoredAccount: SPONSORED,
      entryLabel: `USDC:${ISSUER}`,
    });
    expect(result.hash).toHaveLength(64);
  });

  it("cancelling in Freighter signs nothing further and submits nothing", async () => {
    const server = horizonStub();
    const sign = vi.fn().mockResolvedValue({ error: { message: "User declined." } });

    await expect(
      endSponsorshipWithFreighter(SPONSOR, TRUSTLINE_ROW, { server, sign })
    ).rejects.toThrow("User declined.");

    expect(server.submitTransaction).not.toHaveBeenCalled();
  });

  it("refuses an unidentifiable row before loading the account or signing", async () => {
    const server = horizonStub();
    const sign = vi.fn();

    await expect(
      endSponsorshipWithFreighter(SPONSOR, { entryType: "offer" }, { server, sign })
    ).rejects.toThrow(/cannot be identified/);

    expect(server.loadAccount).not.toHaveBeenCalled();
    expect(sign).not.toHaveBeenCalled();
    expect(server.submitTransaction).not.toHaveBeenCalled();
  });
});
