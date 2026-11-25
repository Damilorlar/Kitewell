import * as StellarSdk from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";
import { getActiveNetwork } from "./network";

/**
 * Ending a sponsorship is a separate transaction, and the lab had no form for
 * one entry. These helpers turn one row of the sponsorship list into exactly
 * one revoke-sponsorship operation.
 *
 * A row is what the list holds for one entry, for example:
 *   { sponsoredAccount: "G…", entryType: "trustline",
 *     assetCode: "USDC", assetIssuer: "G…" }
 *
 * Rows whose entry cannot be identified produce no action: the panel must not
 * offer an end button it cannot turn into an operation.
 */

const MAX_ASSET_CODE_LENGTH = 12;

export const UNIDENTIFIED_ENTRY_MESSAGE =
  "This sponsorship entry cannot be identified, so it cannot be ended.";

/** Identify the sponsored ledger entry behind a sponsorship row. */
export function identifySponsorshipEntry(row = {}) {
  const sponsoredAccount =
    typeof row?.sponsoredAccount === "string"
      ? row.sponsoredAccount.trim()
      : "";
  if (!StellarSdk.StrKey.isValidEd25519PublicKey(sponsoredAccount)) return null;

  if (row?.entryType !== "trustline") return null;

  const assetCode =
    typeof row.assetCode === "string" ? row.assetCode.trim().toUpperCase() : "";
  const assetIssuer =
    typeof row.assetIssuer === "string" ? row.assetIssuer.trim() : "";

  if (!assetCode || assetCode.length > MAX_ASSET_CODE_LENGTH) return null;
  if (!StellarSdk.StrKey.isValidEd25519PublicKey(assetIssuer)) return null;

  return {
    entryType: "trustline",
    sponsoredAccount,
    assetCode,
    assetIssuer,
    entryLabel: `${assetCode}:${assetIssuer}`,
  };
}

/** True when the row can be turned into a revoke-sponsorship operation. */
export function hasEndSponsorshipAction(row) {
  return identifySponsorshipEntry(row) !== null;
}

/**
 * What the confirmation shows before anything is signed: the sponsored account
 * and the entry being revoked.
 */
export function describeEndSponsorship(row) {
  const entry = identifySponsorshipEntry(row);
  if (!entry) return null;

  return {
    sponsoredAccount: entry.sponsoredAccount,
    entryLabel: `${entry.entryLabel} trustline`,
    message:
      `End the sponsorship of the ${entry.entryLabel} trustline held by ` +
      `${entry.sponsoredAccount}? This sends one revoke-sponsorship ` +
      "operation; nothing else about the account changes.",
  };
}

/** The single revoke-sponsorship operation for a trustline sponsorship row. */
export function revokeSponsorshipOperation(row) {
  const entry = identifySponsorshipEntry(row);
  if (!entry) throw new Error(UNIDENTIFIED_ENTRY_MESSAGE);

  return StellarSdk.Operation.revokeTrustlineSponsorship({
    account: entry.sponsoredAccount,
    asset: new StellarSdk.Asset(entry.assetCode, entry.assetIssuer),
  });
}

/** Build the one-operation transaction that ends a sponsorship. */
export function buildRevokeSponsorshipTransaction({
  sponsor,
  row,
  sequence = "0",
  passphrase = getActiveNetwork().passphrase,
  timeout = 180,
} = {}) {
  if (!StellarSdk.StrKey.isValidEd25519PublicKey(sponsor)) {
    throw new Error("Connect a valid Freighter address first.");
  }

  return new StellarSdk.TransactionBuilder(
    new StellarSdk.Account(sponsor, sequence),
    {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: passphrase,
    }
  )
    .addOperation(revokeSponsorshipOperation(row))
    .setTimeout(timeout)
    .build();
}

/**
 * Sign the single revoke operation with Freighter and submit it to Horizon.
 *
 * @returns {Promise<{ hash: string, sponsoredAccount: string, entryLabel: string }>}
 */
export async function endSponsorshipWithFreighter(
  sponsor,
  row,
  { server, sign = signTransaction, passphrase = getActiveNetwork().passphrase } = {}
) {
  if (!StellarSdk.StrKey.isValidEd25519PublicKey(sponsor)) {
    throw new Error("Connect a valid Freighter address first.");
  }

  const entry = identifySponsorshipEntry(row);
  if (!entry) throw new Error(UNIDENTIFIED_ENTRY_MESSAGE);

  const horizon = server ?? new StellarSdk.Horizon.Server(getActiveNetwork().horizonUrl);
  const sourceAccount = await horizon.loadAccount(sponsor);
  const transaction = buildRevokeSponsorshipTransaction({
    sponsor,
    row,
    sequence: sourceAccount.sequenceNumber(),
    passphrase,
  });

  const signResult = await sign(transaction.toXDR(), {
    networkPassphrase: passphrase,
    address: sponsor,
  });

  if (signResult?.error || !signResult?.signedTxXdr) {
    throw new Error(
      signResult?.error?.message || "Signing was rejected in Freighter."
    );
  }

  const signed = StellarSdk.TransactionBuilder.fromXDR(
    signResult.signedTxXdr,
    passphrase
  );
  const result = await horizon.submitTransaction(signed);

  return {
    hash: result.hash,
    sponsoredAccount: entry.sponsoredAccount,
    entryLabel: entry.entryLabel,
  };
}
