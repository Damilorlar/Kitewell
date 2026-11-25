import { StrKey } from "@stellar/stellar-sdk";

const MAX_MUXED_ID = (1n << 64n) - 1n;

/**
 * Coerce a muxed-account id to a non-negative BigInt.
 *
 * Accepts a `bigint`, a safe non-negative integer `number`, or a decimal
 * digit string (the safest form for ids near `2^64 - 1`).
 */
function coerceMuxedId(id) {
  if (typeof id === "bigint") {
    if (id < 0n) {
      throw new TypeError("id must be a non-negative integer.");
    }
    return id;
  }

  if (typeof id === "number") {
    if (!Number.isSafeInteger(id) || id < 0) {
      throw new TypeError("id must be a non-negative integer.");
    }
    return BigInt(id);
  }

  if (typeof id === "string") {
    if (!/^\d+$/.test(id)) {
      throw new TypeError("id must be a decimal integer.");
    }
    return BigInt(id);
  }

  throw new TypeError("id must be a bigint, integer, or decimal string.");
}

/**
 * Combine a G… base account and an unsigned 64-bit id into an M… muxed
 * address. Id 0 is valid; non-integers, negatives, and values above
 * `2^64 - 1` are refused.
 *
 * @param {string} gAddress Base Ed25519 public key (G…).
 * @param {bigint|number|string} id Sub-account id.
 * @returns {string} Muxed account address (M…).
 */
export function buildMuxedAddress(gAddress, id) {
  if (typeof gAddress !== "string") {
    throw new TypeError("Base address must be a string.");
  }
  if (!StrKey.isValidEd25519PublicKey(gAddress)) {
    throw new Error("Base address must be a valid Stellar public key (G…).");
  }

  const bigId = coerceMuxedId(id);
  if (bigId > MAX_MUXED_ID) {
    throw new Error("id must be in the range [0, 2^64 - 1].");
  }

  const raw = new Uint8Array(40);
  new DataView(raw.buffer).setBigUint64(0, bigId, false);
  raw.set(StrKey.decodeEd25519PublicKey(gAddress), 8);

  return StrKey.encodeMed25519PublicKey(raw);
}

/**
 * Split an M… muxed address into its base account and unsigned 64-bit id.
 * The id is returned as a BigInt because it may exceed `Number.MAX_SAFE_INTEGER`.
 *
 * @param {string} muxedAddress Muxed account address (M…).
 * @returns {{ gAddress: string, id: bigint }}
 */
export function splitMuxedAddress(muxedAddress) {
  if (typeof muxedAddress !== "string") {
    throw new TypeError("Muxed address must be a string.");
  }
  if (!StrKey.isValidMed25519PublicKey(muxedAddress)) {
    throw new Error("Muxed address must be a valid M… address.");
  }

  const raw = StrKey.decodeMed25519PublicKey(muxedAddress);
  const id = new DataView(
    raw.buffer,
    raw.byteOffset,
    raw.byteLength
  ).getBigUint64(0, false);

  return {
    gAddress: StrKey.encodeEd25519PublicKey(raw.subarray(8)),
    id,
  };
}

/**
 * Truncate a Stellar address (or any identifier) for display as
 * `GGGGGG…WWWWWW`.
 *
 * Falsy input is returned as-is (so `null`/`undefined`/`""` never render as
 * "undefined…"), and values that already fit within the kept characters are
 * returned untouched. `leading`/`trailing` default to the 6+6 split the
 * dashboard previously hard-coded in App.jsx.
 *
 * @param {string|null|undefined} address
 * @param {number} leading characters kept from the start
 * @param {number} trailing characters kept from the end
 * @returns {string|null|undefined}
 */
export function shortenAddress(address, leading = 6, trailing = 6) {
  if (!address) return address;

  const value = String(address);
  if (value.length < leading + trailing) return value;

  return `${value.slice(0, leading)}…${value.slice(-trailing)}`;
}
