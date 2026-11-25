/**
 * Multi-sig envelope co-signing: inspect a pasted envelope, add the connected
 * Freighter account's signature without dropping existing ones, and submit once
 * the medium threshold is met. Kept separate from freighter.js so it loads on
 * its own.
 */
import { getNetwork, signTransaction } from "@stellar/freighter-api";
import * as StellarSdk from "@stellar/stellar-sdk";
import { findNetworkByPassphrase, getActiveNetwork } from "./network";

/**
 * Summarize which account signers already signed `transaction` and which
 * thresholds their combined weight meets. `account` is a Horizon account
 * record ({ signers: [{ key, weight }], thresholds: { low_threshold, ... } }).
 *
 * A signature only counts when it verifies against this transaction's hash on
 * the lab's network. A signature whose hint matches a signer but that does not
 * verify is reported in `invalid` — usually an envelope signed on another
 * network.
 */
export function summarizeEnvelopeSignatures(transaction, account) {
  const hash = transaction.hash();
  const signers = (account?.signers || []).filter(
    (signer) =>
      signer.weight > 0 &&
      StellarSdk.StrKey.isValidEd25519PublicKey(signer.key)
  );
  const raw = account?.thresholds || {};
  const thresholds = {
    low: raw.low_threshold ?? raw.low ?? 0,
    medium: raw.med_threshold ?? raw.medium ?? 0,
    high: raw.high_threshold ?? raw.high ?? 0,
  };

  const signed = new Set();
  let invalid = 0;
  let unknown = 0;
  for (const signature of transaction.signatures || []) {
    const hint = signature.hint().toString("hex");
    const candidates = signers.filter(
      (signer) =>
        StellarSdk.Keypair.fromPublicKey(signer.key)
          .signatureHint()
          .toString("hex") === hint
    );
    if (candidates.length === 0) {
      unknown += 1;
      continue;
    }
    const match = candidates.find((signer) =>
      StellarSdk.Keypair.fromPublicKey(signer.key).verify(
        hash,
        signature.signature()
      )
    );
    if (match) signed.add(match.key);
    else invalid += 1;
  }

  const rows = signers.map((signer) => ({
    key: signer.key,
    weight: signer.weight,
    signed: signed.has(signer.key),
  }));
  const totalWeight = rows
    .filter((row) => row.signed)
    .reduce((sum, row) => sum + row.weight, 0);

  return {
    signers: rows,
    totalWeight,
    thresholds,
    meets: {
      // Stellar treats a threshold of 0 as "any one valid signature".
      low: totalWeight >= Math.max(thresholds.low, 1),
      medium: totalWeight >= Math.max(thresholds.medium, 1),
      high: totalWeight >= Math.max(thresholds.high, 1),
    },
    invalid,
    unknown,
  };
}

function getServer() {
  return new StellarSdk.Horizon.Server(getActiveNetwork().horizonUrl);
}

function currentPassphrase() {
  return getActiveNetwork().passphrase;
}

function assertPublicKey(publicKey) {
  if (!StellarSdk.StrKey.isValidEd25519PublicKey(publicKey)) {
    throw new Error("Connect a valid Freighter address first.");
  }
}

async function assertFreighterNetworkMatches() {
  const lab = getActiveNetwork();
  const freighter = await getNetwork();
  if (freighter?.error) {
    throw new Error(freighter.error.message || "Could not read the network from Freighter.");
  }
  const passphrase = freighter?.networkPassphrase;
  if (!passphrase || passphrase === lab.passphrase) return;
  const label = findNetworkByPassphrase(passphrase)?.label || freighter.network || "unknown";
  throw new Error(
    `Freighter is on ${label} but the lab is on ${lab.label}. Switch either side to match before signing.`
  );
}

async function signWithFreighter(xdr, publicKey) {
  const passphrase = currentPassphrase();
  const result = await signTransaction(xdr, { networkPassphrase: passphrase, address: publicKey });
  if (result.error || !result.signedTxXdr) {
    throw new Error(result.error?.message || "Transaction signing was rejected in Freighter.");
  }
  return StellarSdk.TransactionBuilder.fromXDR(result.signedTxXdr, passphrase);
}

/** Parse a pasted multi-sig envelope on the lab's network. Fee bumps are refused. */
function parseMultisigEnvelope(envelopeXdr) {
  const xdr = (envelopeXdr || "").trim();
  if (!xdr) throw new Error("Paste a transaction envelope first.");
  let transaction;
  try {
    transaction = StellarSdk.TransactionBuilder.fromXDR(xdr, currentPassphrase());
  } catch {
    throw new Error("That is not a valid transaction envelope XDR.");
  }
  if (transaction instanceof StellarSdk.FeeBumpTransaction) {
    throw new Error("Fee-bump envelopes are not supported here.");
  }
  return transaction;
}

function assertSummaryOnLabNetwork(summary) {
  if (summary.invalid > 0) {
    throw new Error(
      `This envelope carries signatures that do not verify on ${getActiveNetwork().label}. It was likely signed for a different network.`
    );
  }
}

/**
 * Load the envelope's source account and report which of its signers already
 * signed and which thresholds are met.
 */
export async function inspectMultisigEnvelope(envelopeXdr) {
  const transaction = parseMultisigEnvelope(envelopeXdr);
  const account = await getServer().loadAccount(transaction.source);
  const summary = summarizeEnvelopeSignatures(transaction, account);
  assertSummaryOnLabNetwork(summary);
  return {
    ...summary,
    source: transaction.source,
    hash: transaction.hash().toString("hex"),
    xdr: transaction.toXDR(),
  };
}

/**
 * Keep every signature on `original` and append only the new ones from
 * `signed`. Existing signatures are never dropped or reordered.
 */
export function mergeEnvelopeSignatures(original, signed) {
  const key = (sig) =>
    `${sig.hint().toString("hex")}:${sig.signature().toString("hex")}`;
  const seen = new Set(original.signatures.map(key));
  for (const sig of signed.signatures) {
    if (!seen.has(key(sig))) {
      original.signatures.push(sig);
      seen.add(key(sig));
    }
  }
  return original;
}

/**
 * Add the connected account's signature to a multi-sig envelope. Refuses a
 * non-signer, an account that already signed, and a network mismatch.
 * Returns the merged envelope plus its fresh summary; nothing is submitted.
 */
export async function addSignatureToEnvelopeWithFreighter(envelopeXdr, publicKey) {
  assertPublicKey(publicKey);
  await assertFreighterNetworkMatches();

  const before = await inspectMultisigEnvelope(envelopeXdr);
  const row = before.signers.find((signer) => signer.key === publicKey);
  if (!row) {
    throw new Error("The connected account is not a signer on this envelope's source account.");
  }
  if (row.signed) {
    throw new Error("The connected account has already signed this envelope.");
  }

  const original = parseMultisigEnvelope(before.xdr);
  const signed = await signWithFreighter(before.xdr, publicKey);
  if (signed.hash().toString("hex") !== before.hash) {
    throw new Error("Freighter returned a different transaction. Nothing was added.");
  }
  const merged = mergeEnvelopeSignatures(original, signed);

  const account = await getServer().loadAccount(merged.source);
  const summary = summarizeEnvelopeSignatures(merged, account);
  assertSummaryOnLabNetwork(summary);
  return {
    ...summary,
    source: merged.source,
    hash: before.hash,
    xdr: merged.toXDR(),
  };
}

/** Submit a multi-sig envelope once its signatures meet the medium threshold. */
export async function submitMultisigEnvelope(envelopeXdr) {
  const summary = await inspectMultisigEnvelope(envelopeXdr);
  if (!summary.meets.medium) {
    throw new Error(
      `Signature weight ${summary.totalWeight} is below the medium threshold (${summary.thresholds.medium}).`
    );
  }
  return getServer().submitTransaction(parseMultisigEnvelope(summary.xdr));
}
