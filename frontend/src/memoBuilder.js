import { Memo } from "@stellar/stellar-sdk";

const MAX_TEXT_BYTES = 28;
const MAX_UINT64 = (1n << 64n) - 1n;
const HEX_32_BYTES = /^[0-9a-fA-F]{64}$/;

function success(value) {
  return { ok: true, value };
}

function failure(code, message) {
  return { ok: false, error: { code, message } };
}

/**
 * Build a Stellar text memo, enforcing the protocol's 28-byte UTF-8 limit.
 * Empty text is valid. Failures are returned as typed results.
 *
 * @param {string} text Text memo contents.
 * @returns {{ok: true, value: import('@stellar/stellar-sdk').Memo}|{ok: false, error: {code: string, message: string}}}
 */
export function buildTextMemo(text) {
  if (typeof text !== "string") {
    return failure("INVALID_TEXT", "Text memo must be a string.");
  }
  if (new TextEncoder().encode(text).length > MAX_TEXT_BYTES) {
    return failure("TEXT_TOO_LONG", "Text memo cannot exceed 28 UTF-8 bytes.");
  }

  try {
    return success(Memo.text(text));
  } catch {
    return failure("INVALID_TEXT", "Text memo is not valid.");
  }
}

function normalizeId(id) {
  let value;
  if (typeof id === "bigint") {
    value = id;
  } else if (typeof id === "number" && Number.isSafeInteger(id)) {
    value = BigInt(id);
  } else if (typeof id === "string" && /^\d+$/.test(id.trim())) {
    value = BigInt(id.trim());
  } else {
    return failure("INVALID_ID", "Memo ID must be a non-negative integer.");
  }

  if (value < 0n || value > MAX_UINT64) {
    return failure("ID_OUT_OF_RANGE", "Memo ID must fit in an unsigned 64-bit integer.");
  }
  return success(value.toString());
}

/**
 * Build a Stellar ID memo from a safe integer, decimal digit string, or bigint.
 * IDs must fit in the protocol's unsigned 64-bit range.
 *
 * @param {number|string|bigint} id Memo ID.
 * @returns {{ok: true, value: import('@stellar/stellar-sdk').Memo}|{ok: false, error: {code: string, message: string}}}
 */
export function buildIdMemo(id) {
  const normalized = normalizeId(id);
  if (!normalized.ok) return normalized;

  try {
    return success(Memo.id(normalized.value));
  } catch {
    return failure("INVALID_ID", "Memo ID could not be constructed.");
  }
}

function normalizeHash(hash) {
  if (typeof hash === "string" && HEX_32_BYTES.test(hash)) {
    return success(hash.toLowerCase());
  }
  if (hash instanceof Uint8Array && hash.length === 32) {
    return success(Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join(""));
  }
  return failure("INVALID_HASH", "Memo hash must contain exactly 32 bytes.");
}

/**
 * Build a Stellar hash memo from 32 bytes or a 64-character hexadecimal string.
 * Hex strings are normalized to lowercase before construction.
 *
 * @param {Uint8Array|string} hash Hash bytes or hexadecimal representation.
 * @returns {{ok: true, value: import('@stellar/stellar-sdk').Memo}|{ok: false, error: {code: string, message: string}}}
 */
export function buildHashMemo(hash) {
  const normalized = normalizeHash(hash);
  if (!normalized.ok) return normalized;

  try {
    return success(Memo.hash(normalized.value));
  } catch {
    return failure("INVALID_HASH", "Memo hash could not be constructed.");
  }
}