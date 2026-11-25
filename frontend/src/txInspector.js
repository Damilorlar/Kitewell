import * as StellarSdk from "@stellar/stellar-sdk";
import { getAvailableNetworks } from "./network";

/**
 * Read-only decoder for Stellar transaction envelopes.
 *
 * The inspector never signs or submits anything: it parses the base64 XDR a
 * signer was handed and turns it into plain display data. Decoding on a
 * network passphrase is not enough on its own to detect a network mismatch
 * (the passphrase is not stored in the envelope), so when signatures are
 * present we also verify them against the selected passphrase. A signature
 * that verifies on a different known network — or that carries a signer hint
 * matching a known account but does not verify here — means the envelope was
 * built for another network.
 */

export const XDR_READ_ERROR = "XDR could not be read.";
export const PASSPHRASE_MISMATCH_ERROR =
  "Network passphrase does not match this envelope.";

const FIELD_LABELS = {
  source: "Source",
  destination: "Destination",
  amount: "Amount",
  asset: "Asset",
  startingBalance: "Starting balance",
  line: "Asset",
  limit: "Limit",
  selling: "Selling",
  buying: "Buying",
  price: "Price",
  offerId: "Offer ID",
  sendAsset: "Send asset",
  sendAmount: "Send amount",
  sendMax: "Maximum sent",
  destAsset: "Destination asset",
  destMin: "Minimum received",
  destAmount: "Destination amount",
  path: "Path",
  name: "Name",
  value: "Value",
  dataName: "Name",
  dataValue: "Value",
  homeDomain: "Home domain",
  inflationDest: "Inflation destination",
  masterWeight: "Master weight",
  lowThreshold: "Low threshold",
  medThreshold: "Medium threshold",
  highThreshold: "High threshold",
  signer: "Signer",
  bumpTo: "Bump to",
  claimant: "Claimant",
  claimableBalanceId: "Claimable balance ID",
  sponsoredId: "Sponsored account",
  balanceId: "Balance ID",
  liquidityPoolId: "Liquidity pool ID",
  trustor: "Trustor",
  trustlineAsset: "Trustline asset",
  authorize: "Authorize",
  function: "Function",
  parameters: "Parameters",
};

function decodeError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isUint8Array(value) {
  return value instanceof Uint8Array;
}

/** Describe a decoded asset. Native XLM is displayed as `XLM`. */
export function formatAsset(asset) {
  if (asset == null) return null;
  if (typeof asset === "string") return asset;

  if (typeof asset.isNative === "function" && asset.isNative()) return "XLM";

  if (asset.code) {
    const code = String(asset.code);
    return asset.issuer ? `${code}:${asset.issuer}` : code;
  }

  return String(asset);
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bufferToText(bytes) {
  const text = new TextDecoder().decode(bytes);
  // Text-like values (manageData payloads, text memos) read best as UTF-8;
  // arbitrary binary falls back to a hex preview.
  return /^[\x20-\x7e\r\n\t]*$/.test(text) ? text : bytesToHex(bytes);
}

function isAssetLike(value) {
  return (
    value &&
    typeof value === "object" &&
    !isUint8Array(value) &&
    typeof value.code === "string"
  );
}

/** Turn one decoded operation field into display text. */
export function formatOperationValue(value) {
  if (value == null) return null;
  if (isAssetLike(value)) return formatAsset(value);
  if (isUint8Array(value)) return bufferToText(value);

  if (Array.isArray(value)) {
    return value.map((entry) => formatOperationValue(entry)).join(", ");
  }

  if (typeof value === "bigint") return value.toString();
  if (typeof value === "object") {
    if (isAssetLike(value)) return formatAsset(value);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

/**
 * List an operation's fields in a stable, human-readable order, excluding its
 * type (rendered as the block heading).
 */
export function operationFields(operation) {
  if (!operation || typeof operation !== "object") return [];

  return Object.entries(operation)
    .filter(
      ([key, value]) =>
        key !== "type" && key !== "fields" && key !== "index" && value != null
    )
    .map(([key, value]) => ({
      key,
      label: FIELD_LABELS[key] || key,
      value: formatOperationValue(value),
    }));
}

/** Normalize an SDK memo into `{ type, value }`, or null for no memo. */
export function formatMemo(memo) {
  if (!memo || !memo.type || memo.type === "none") return null;

  const type = memo.type;
  let value = memo.value;
  if (value == null) return null;

  if (type === "text") {
    value = isUint8Array(value) ? bufferToText(value) : String(value);
  } else if (type === "id") {
    value = String(value);
  } else {
    value = isUint8Array(value) ? bytesToHex(value) : String(value);
  }

  return { type, value };
}

/** Normalize SDK time bounds into strings (protocol epoch seconds). */
export function formatTimeBounds(timeBounds) {
  if (!timeBounds) return null;

  return {
    minTime: String(timeBounds.minTime ?? "0"),
    maxTime: String(timeBounds.maxTime ?? "0"),
  };
}

function describeOperation(operation, index) {
  const fields = operationFields(operation);
  const summary = {};
  for (const field of fields) summary[field.key] = field.value;

  return {
    index,
    type: operation.type,
    ...summary,
    fields,
  };
}

function describeTransaction(transaction) {
  return {
    source: transaction.source,
    fee: String(transaction.fee),
    sequence: String(transaction.sequence),
    memo: formatMemo(transaction.memo),
    timeBounds: formatTimeBounds(transaction.timeBounds),
    operations: transaction.operations.map(describeOperation),
  };
}

function networkForPassphrase(passphrase) {
  const match = getAvailableNetworks().find(
    (network) => network.passphrase === passphrase
  );

  return match
    ? { id: match.id, label: match.label, passphrase }
    : { id: null, label: null, passphrase };
}

function transactionSigners(transaction) {
  const keys = new Set();
  const add = (value) => {
    if (typeof value !== "string") return;
    try {
      StellarSdk.StrKey.decodeEd25519PublicKey(value);
      keys.add(value);
    } catch {
      /* ignore muxed or malformed values */
    }
  };

  if (transaction instanceof StellarSdk.FeeBumpTransaction) {
    add(transaction.feeSource);
    add(transaction.innerTransaction.source);
    transaction.innerTransaction.operations.forEach((op) => add(op.source));
  } else {
    add(transaction.source);
    transaction.operations.forEach((op) => add(op.source));
  }

  return [...keys];
}

function hashForPassphrase(transaction, passphrase) {
  const networkId = StellarSdk.xdr.Hash.fromXDR(StellarSdk.hash(passphrase));
  const taggedTransaction =
    transaction instanceof StellarSdk.FeeBumpTransaction
      ? StellarSdk.xdr.TransactionSignaturePayloadTaggedTransaction.envelopeTypeTxFeeBump(
          transaction.tx
        )
      : StellarSdk.xdr.TransactionSignaturePayloadTaggedTransaction.envelopeTypeTx(
          transaction.tx
        );

  return StellarSdk.hash(
    new StellarSdk.xdr.TransactionSignaturePayload({
      networkId,
      taggedTransaction,
    }).toXDR()
  );
}

function usableSignatures(transaction) {
  if (!Array.isArray(transaction.signatures)) return [];

  return transaction.signatures.filter((signature) => {
    try {
      const bytes = signature.signature();
      return bytes && bytes.length > 0;
    } catch {
      return false;
    }
  });
}

function signatureVerifies(transaction, signatures, signers, passphrase) {
  let hash;
  try {
    hash = hashForPassphrase(transaction, passphrase);
  } catch {
    return false;
  }

  return signatures.some((signature) => {
    const bytes = signature.signature();
    return signers.some((publicKey) => {
      try {
        return StellarSdk.Keypair.fromPublicKey(publicKey).verify(hash, bytes);
      } catch {
        return false;
      }
    });
  });
}

function hintMatchesSigner(signatures, signers) {
  const hints = signers.map((publicKey) => {
    try {
      return StellarSdk.StrKey.decodeEd25519PublicKey(publicKey).subarray(28);
    } catch {
      return null;
    }
  });

  return signatures.some((signature) => {
    let hint;
    try {
      hint = signature.hint();
    } catch {
      return false;
    }
    if (!hint || hint.length !== 4) return false;

    return hints.some(
      (expected) =>
        expected &&
        expected.length === hint.length &&
        expected.every((byte, index) => byte === hint[index])
    );
  });
}

/**
 * Returns true when the signatures prove the selected passphrase is right,
 * false when they prove it is wrong, and null when the envelope carries no
 * signatures we can check.
 */
function passphraseVerdict(transaction, passphrase) {
  const signatures = usableSignatures(transaction);
  if (signatures.length === 0) return null;

  const signers = transactionSigners(transaction);
  if (signers.length === 0) return null;

  if (signatureVerifies(transaction, signatures, signers, passphrase)) {
    return true;
  }

  for (const network of getAvailableNetworks()) {
    if (network.passphrase === passphrase) continue;
    if (
      signatureVerifies(transaction, signatures, signers, network.passphrase)
    ) {
      return false;
    }
  }

  // A signature whose hint names one of the envelope's own accounts but
  // which does not verify here was produced for a different passphrase.
  return hintMatchesSigner(signatures, signers) ? false : null;
}

function envelopePassphraseMatches(transaction, passphrase) {
  const verdicts = [passphraseVerdict(transaction, passphrase)];

  if (transaction instanceof StellarSdk.FeeBumpTransaction) {
    verdicts.push(passphraseVerdict(transaction.innerTransaction, passphrase));
  }

  const known = verdicts.filter((verdict) => verdict !== null);
  return known.every(Boolean);
}

/**
 * Decode a base64 transaction envelope on the given network passphrase.
 *
 * @param {string} xdr Base64-encoded transaction envelope.
 * @param {string} passphrase Passphrase of the network selected in the UI.
 * @returns {object} Display data for the transaction (or fee bump + inner tx).
 * @throws {Error} `XDR could not be read.` when the envelope is malformed, or
 *   `Network passphrase does not match this envelope.` when it belongs to a
 *   different network.
 */
export function decodeTransactionEnvelope(xdr, passphrase) {
  const envelope = typeof xdr === "string" ? xdr.trim() : "";
  if (!envelope) {
    throw decodeError(XDR_READ_ERROR, "XDR_UNREADABLE");
  }

  let transaction;
  try {
    transaction = StellarSdk.TransactionBuilder.fromXDR(envelope, passphrase);
  } catch {
    throw decodeError(XDR_READ_ERROR, "XDR_UNREADABLE");
  }

  if (!envelopePassphraseMatches(transaction, passphrase)) {
    throw decodeError(PASSPHRASE_MISMATCH_ERROR, "PASSPHRASE_MISMATCH");
  }

  const network = networkForPassphrase(passphrase);

  if (transaction instanceof StellarSdk.FeeBumpTransaction) {
    return {
      isFeeBump: true,
      network,
      feeSource: transaction.feeSource,
      fee: String(transaction.fee),
      inner: describeTransaction(transaction.innerTransaction),
    };
  }

  return {
    isFeeBump: false,
    network,
    ...describeTransaction(transaction),
  };
}
