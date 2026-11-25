/**
 * Transaction-envelope decoder.
 *
 * The classic view of an envelope is fee, sequence, signatures, and one line
 * per operation. A Soroban `invokeHostFunction` used to arrive there as an
 * opaque operation, so this decoder adds the contract address, the function
 * name, and the arguments (with their XDR types). Classic operations stay as
 * they are and never gain a contract section.
 *
 * @module envelopeDecoder
 */

import * as StellarSdk from "@stellar/stellar-sdk";
import { getActiveNetwork } from "./network";

const SCVAL_TYPE_NAMES = {
  scvBool: "SCV_BOOL",
  scvVoid: "SCV_VOID",
  scvError: "SCV_ERROR",
  scvU32: "SCV_U32",
  scvI32: "SCV_I32",
  scvU64: "SCV_U64",
  scvI64: "SCV_I64",
  scvTimepoint: "SCV_TIMEPOINT",
  scvDuration: "SCV_DURATION",
  scvU128: "SCV_U128",
  scvI128: "SCV_I128",
  scvU256: "SCV_U256",
  scvI256: "SCV_I256",
  scvBytes: "SCV_BYTES",
  scvString: "SCV_STRING",
  scvSymbol: "SCV_SYMBOL",
  scvVec: "SCV_VEC",
  scvMap: "SCV_MAP",
  scvAddress: "SCV_ADDRESS",
  scvContractInstance: "SCV_CONTRACT_INSTANCE",
  scvLedgerKeyContractInstance: "SCV_LEDGER_KEY_CONTRACT_INSTANCE",
  scvLedgerKeyNonce: "SCV_LEDGER_KEY_NONCE",
};

function toHex(value) {
  if (!value) return "";
  const bytes = value instanceof Uint8Array ? value : Uint8Array.from(value);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toBase64(value) {
  if (!value) return "";
  const bytes = value instanceof Uint8Array ? value : Uint8Array.from(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** The XDR type name of an ScVal, e.g. `SCV_I32`. */
export function xdrTypeName(scVal) {
  const raw = scVal?.switch?.().name ?? "";
  if (!raw) return "UNKNOWN";
  return SCVAL_TYPE_NAMES[raw] ?? raw.toUpperCase().replace(/^SCV/, "SCV_");
}

/** Make a decoded native value safe to render (bigints, bytes, arrays, maps). */
function normalizeValue(value) {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array || ArrayBuffer.isView(value)) {
    return toHex(value);
  }
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value instanceof Map) {
    return Object.fromEntries(
      [...value.entries()].map(([key, entry]) => [String(key), normalizeValue(entry)])
    );
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalizeValue(entry)])
    );
  }
  return value;
}

/**
 * Decode one Soroban argument.
 *
 * @param {object} scVal The argument as an SDK ScVal.
 * @returns {{type: string, value: unknown, hex: string|null}} Its XDR type and
 *   decoded value, or the raw XDR hex when the value cannot be decoded.
 */
export function decodeArgument(scVal) {
  const type = xdrTypeName(scVal);
  try {
    return { type, value: normalizeValue(StellarSdk.scValToNative(scVal)), hex: null };
  } catch {
    return { type, value: null, hex: toHex(scVal.toXDR()) };
  }
}

/** Render a decoded argument for the panel. */
export function formatArgumentValue(argument) {
  if (!argument) return "—";
  if (argument.hex) return argument.hex;
  if (argument.value === null || argument.value === undefined) return "void";
  if (typeof argument.value === "string") return argument.value;
  return JSON.stringify(argument.value);
}

function assetLabel(asset) {
  if (!asset) return null;
  if (typeof asset.isNative === "function" && asset.isNative()) return "XLM (native)";
  const code = typeof asset.getCode === "function" ? asset.getCode() : null;
  const issuer = typeof asset.getIssuer === "function" ? asset.getIssuer() : null;
  if (code && issuer) return `${code}:${issuer}`;
  return code ?? null;
}

function describeInvoke(operation) {
  const hostFunction = operation.func;
  const hostFunctionType = hostFunction?.switch?.().name ?? null;
  const described = { hostFunctionType, address: null, function: null, args: [] };

  // Only an invokeContract carries a contract address, a function, and args.
  if (hostFunctionType !== "hostFunctionTypeInvokeContract") return described;

  const invoke = hostFunction.invokeContract();
  const address = (() => {
    try {
      return StellarSdk.Address.fromScAddress(invoke.contractAddress()).toString();
    } catch {
      return null;
    }
  })();

  return {
    hostFunctionType,
    address,
    function: invoke.functionName().toString(),
    args: invoke.args().map(decodeArgument),
  };
}

/**
 * Describe one operation. Classic operations keep their fields; a Soroban
 * invoke adds a `contract` section.
 */
export function describeOperation(operation) {
  const described = { type: operation.type, source: operation.source ?? null };

  if (operation.type === "invokeHostFunction") {
    return { ...described, contract: describeInvoke(operation) };
  }

  if (operation.type === "payment") {
    return {
      ...described,
      destination: operation.destination,
      amount: operation.amount,
      asset: assetLabel(operation.asset),
    };
  }

  if (operation.type === "changeTrust") {
    return {
      ...described,
      asset: assetLabel(operation.line),
      limit: operation.limit,
    };
  }

  return described;
}

function memoValue(memo) {
  if (!memo || memo.type === "none") return null;
  if (memo.type === "text" || memo.type === "id") {
    return memo.value === null || memo.value === undefined ? null : String(memo.value);
  }
  return toHex(memo.value);
}

/**
 * Decode a base64 transaction envelope.
 *
 * A fee-bump envelope is unwrapped to its inner transaction, so an inner
 * invoke is still named. The outer fee is reported alongside the inner fee.
 *
 * @param {string} envelopeXdr Base64 envelope XDR.
 * @param {string} [passphrase] Network passphrase; defaults to the active one.
 * @returns {object} Envelope summary with classic fields and operations.
 * @throws {Error} When the XDR is missing or cannot be decoded.
 */
export function decodeEnvelope(envelopeXdr, passphrase = getActiveNetwork().passphrase) {
  if (typeof envelopeXdr !== "string" || !envelopeXdr.trim()) {
    throw new Error("Paste a transaction envelope XDR to decode.");
  }

  let parsed;
  try {
    parsed = StellarSdk.TransactionBuilder.fromXDR(envelopeXdr.trim(), passphrase);
  } catch {
    throw new Error("Could not decode the envelope XDR.");
  }

  const isFeeBump = Boolean(parsed.innerTransaction);
  const inner = isFeeBump ? parsed.innerTransaction : parsed;

  return {
    kind: isFeeBump ? "feeBump" : "transaction",
    fee: String(parsed.fee),
    innerFee: isFeeBump ? String(inner.fee) : null,
    sequence: String(inner.sequence),
    source: inner.source,
    memo: { type: inner.memo?.type ?? "none", value: memoValue(inner.memo) },
    timeBounds: inner.timeBounds ?? null,
    signatures: (parsed.signatures ?? []).map((signature) => ({
      hint: toHex(signature.hint()),
      signature: toBase64(signature.signature()),
    })),
    operations: inner.operations.map(describeOperation),
  };
}
