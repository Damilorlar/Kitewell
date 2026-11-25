/**
 * Check the format of a Stellar Ed25519 public key (a G-address) offline.
 *
 * This checks the 56-character base32 encoding and the 0x30 version byte.
 * It does not verify the StrKey checksum or whether an account exists.
 *
 * @param {unknown} address Value to check.
 * @returns {boolean} Whether the value has the expected G-address format.
 */
export function isValidStellarAddress(address) {
  // The first two base32 symbols encode the version byte: 0x30 => GA, GB, GC, or GD.
  return typeof address === "string"
    && address.length === 56
    && /^G[A-D][A-Z2-7]{54}$/.test(address);
}
