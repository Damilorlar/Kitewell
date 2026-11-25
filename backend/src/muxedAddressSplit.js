/**
 * Muxed account address splitter / combiner.
 *
 * A Stellar muxed account address (M...) encodes two pieces of information:
 *
 *  1. A base Ed25519 public key (a normal G... address).
 *  2. A 64-bit unsigned integer id that distinguishes virtual sub-accounts
 *     sharing the same on-chain account.
 *
 * This module provides two pure, side-effect-free utilities:
 *
 *  - {@link splitMuxedAddress}  — given an M... address, return the G...
 *    base address and the numeric `id` as a `BigInt`.
 *  - {@link buildMuxedAddress}  — given a G... address and a numeric `id`,
 *    return the corresponding M... address string.
 *
 * Neither function touches the network. The `@stellar/stellar-sdk` StrKey
 * codec handles all encoding/decoding; this module only arranges the bytes
 * and validates the inputs.
 *
 * SEP-23 Strkey reference:
 *   https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0023.md
 */

import { StrKey } from "@stellar/stellar-sdk";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum value a uint64 id may hold (2^64 − 1). */
const MAX_ID = 18446744073709551615n;

/** Minimum value a uint64 id may hold. */
const MIN_ID = 0n;

// ─── Exported functions ───────────────────────────────────────────────────────

/**
 * Split a Stellar muxed account address (M...) into its components.
 *
 * The M... address is a StrKey-encoded `MuxedAccount` that contains an 8-byte
 * big-endian uint64 id followed by the 32-byte raw Ed25519 public key.
 * `splitMuxedAddress` decodes it and re-encodes the key portion back into the
 * familiar G... format.
 *
 * @param {unknown} muxedAddress  The muxed account address to split.
 * @returns {{ gAddress: string, id: bigint }}  The base G... address and the
 *   numeric id as a `BigInt`.
 *
 * @throws {TypeError}  If `muxedAddress` is not a string.
 * @throws {Error}      If `muxedAddress` is not a valid M... address (wrong
 *   version byte, bad checksum, wrong length, etc.).
 *
 * @example
 * const { gAddress, id } = splitMuxedAddress(
 *   "MAAAAAAAAAAAAKVIJ3GTJW3J52OXQBGC76YXABE7OQ53XHCGWJD7Q6QPHGRDSHRPHHTZO"
 * );
 * // gAddress → "GCUE5TJU3NU65HLYATBP7MLQASPXIO53TRDLER7YPIHTTIRZDYXTTKDN"
 * // id       → 42n
 */
export function splitMuxedAddress(muxedAddress) {
  if (typeof muxedAddress !== "string") {
    throw new TypeError(
      `muxedAddress must be a string, got ${typeof muxedAddress}`,
    );
  }

  if (!StrKey.isValidMed25519PublicKey(muxedAddress)) {
    throw new Error(
      `"${muxedAddress}" is not a valid muxed account address (M...)`,
    );
  }

  // The 40 decoded bytes are: [0-7] big-endian uint64 id, [8-39] raw key.
  const raw = StrKey.decodeMed25519PublicKey(muxedAddress);
  const id = raw.readBigUInt64BE(0);
  const keyBytes = raw.subarray(8);
  const gAddress = StrKey.encodeEd25519PublicKey(keyBytes);

  return { gAddress, id };
}

/**
 * Combine a G... base address and a numeric id into a muxed M... address.
 *
 * The `id` may be supplied as a `BigInt`, a `number`, or a decimal `string`.
 * It must be a non-negative integer in the range `[0, 2^64 − 1]`. Fractional
 * or negative values are rejected.
 *
 * @param {unknown} gAddress  A valid Stellar Ed25519 public key (G...).
 * @param {unknown} id        The uint64 sub-account id (BigInt, number, or
 *   decimal string).
 * @returns {string}  The corresponding M... muxed account address.
 *
 * @throws {TypeError}  If `gAddress` is not a string, or `id` cannot be
 *   converted to a non-negative integer `BigInt`.
 * @throws {Error}      If `gAddress` is not a valid G... address, or `id` is
 *   outside the uint64 range `[0, 2^64 − 1]`.
 *
 * @example
 * const mAddress = buildMuxedAddress(
 *   "GCUE5TJU3NU65HLYATBP7MLQASPXIO53TRDLER7YPIHTTIRZDYXTTKDN",
 *   42n
 * );
 * // → "MAAAAAAAAAAAAKVIJ3GTJW3J52OXQBGC76YXABE7OQ53XHCGWJD7Q6QPHGRDSHRPHHTZO"
 */
export function buildMuxedAddress(gAddress, id) {
  if (typeof gAddress !== "string") {
    throw new TypeError(
      `gAddress must be a string, got ${typeof gAddress}`,
    );
  }

  if (!StrKey.isValidEd25519PublicKey(gAddress)) {
    throw new Error(
      `"${gAddress}" is not a valid G... Ed25519 public key`,
    );
  }

  const bigId = coerceId(id);

  if (bigId < MIN_ID || bigId > MAX_ID) {
    throw new Error(
      `id must be in the range [0, 2^64 − 1], got ${bigId}`,
    );
  }

  // Pack: 8-byte big-endian id || 32-byte raw key → 40 bytes → M... StrKey.
  const rawKey = StrKey.decodeEd25519PublicKey(gAddress);
  const buf = Buffer.allocUnsafe(40);
  buf.writeBigUInt64BE(bigId, 0);
  rawKey.copy(buf, 8);

  return StrKey.encodeMed25519PublicKey(buf);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Convert `value` to a `BigInt` representing a uint64 id, or throw a
 * descriptive `TypeError` if that is not possible.
 *
 * Accepts:
 *  - `BigInt`  — used as-is (sign is checked by the caller).
 *  - `number`  — must be a safe, non-negative integer; converted via
 *    `BigInt(Math.trunc(value))`.
 *  - `string`  — must be a decimal integer string (no `n` suffix, no floats,
 *    no hex).
 *
 * @param {unknown} value
 * @returns {bigint}
 */
function coerceId(value) {
  if (typeof value === "bigint") {
    if (value < 0n) {
      throw new TypeError(`id must be a non-negative integer, got ${value}`);
    }
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0) {
      throw new TypeError(
        `id must be a non-negative integer, got ${value}`,
      );
    }
    return BigInt(value);
  }

  if (typeof value === "string") {
    if (!/^\d+$/.test(value)) {
      throw new TypeError(
        `id string must contain only decimal digits, got "${value}"`,
      );
    }
    return BigInt(value);
  }

  throw new TypeError(
    `id must be a BigInt, number, or decimal string, got ${typeof value}`,
  );
}
