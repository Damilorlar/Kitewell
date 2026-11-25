/**
 * Bounds and error strings for Stellar signer weight validation.
 *
 * A signer weight is the integer stored alongside a signer in a Stellar
 * account's signers list. It controls how much "signing power" that key
 * contributes toward the account's thresholds. The protocol accepts values
 * in the closed range [0, 255] — a weight of 0 effectively removes the signer.
 *
 * This module records those rules only. It does not import the Stellar SDK
 * or talk to Horizon.
 */

/** Minimum accepted weight, inclusive. Zero removes the signer. */
export const SIGNER_WEIGHT_MIN = 0;

/** Maximum accepted weight, inclusive. */
export const SIGNER_WEIGHT_MAX = 255;

/** Stable error strings returned by `validateSignerWeight`. */
export const SIGNER_WEIGHT_ERROR = {
  TYPE: "Signer weight must be a number",
  INTEGER: "Signer weight must be an integer",
  RANGE: "Signer weight must be between 0 and 255",
};
