import {
  SIGNER_WEIGHT_ERROR,
  SIGNER_WEIGHT_MAX,
  SIGNER_WEIGHT_MIN,
} from "./signerWeightValidateConstants.js";

/**
 * Validate a Stellar signer weight value.
 *
 * A signer weight controls how much signing power a key contributes toward an
 * account's operation, low, and high thresholds. The Stellar protocol stores
 * it as an unsigned 8-bit integer, so valid values are the integers 0–255
 * inclusive. A weight of 0 effectively removes the signer.
 *
 * Validation rules (checked in this order):
 *
 * 1. The value must be a `number` (not a string, BigInt, boolean, etc.).
 * 2. It must be a finite integer — `NaN`, `Infinity`, and fractional values
 *    are rejected.
 * 3. It must lie in the closed range [0, 255].
 *
 * Invalid input always returns `{ ok: false, error }` and never throws.
 *
 * @param {unknown} weight Candidate signer weight.
 * @returns {{ ok: true, weight: number } | { ok: false, error: string }}
 *
 * @example
 * validateSignerWeight(10);    // { ok: true, weight: 10 }
 * validateSignerWeight(255);   // { ok: true, weight: 255 }
 * validateSignerWeight(0);     // { ok: true, weight: 0 }
 * validateSignerWeight(1.5);   // { ok: false, error: "Signer weight must be an integer" }
 * validateSignerWeight(-1);    // { ok: false, error: "Signer weight must be between 0 and 255" }
 * validateSignerWeight(256);   // { ok: false, error: "Signer weight must be between 0 and 255" }
 * validateSignerWeight("10");  // { ok: false, error: "Signer weight must be a number" }
 */
export function validateSignerWeight(weight) {
  if (typeof weight !== "number") {
    return { ok: false, error: SIGNER_WEIGHT_ERROR.TYPE };
  }

  if (!Number.isInteger(weight)) {
    return { ok: false, error: SIGNER_WEIGHT_ERROR.INTEGER };
  }

  if (weight < SIGNER_WEIGHT_MIN || weight > SIGNER_WEIGHT_MAX) {
    return { ok: false, error: SIGNER_WEIGHT_ERROR.RANGE };
  }

  return { ok: true, weight };
}

/**
 * Boolean form of {@link validateSignerWeight}.
 *
 * Returns `true` only when `validateSignerWeight` returns `{ ok: true }`.
 * Never throws.
 *
 * @param {unknown} weight Candidate signer weight.
 * @returns {boolean}
 *
 * @example
 * isValidSignerWeight(1);    // true
 * isValidSignerWeight(256);  // false
 * isValidSignerWeight(null); // false
 */
export function isValidSignerWeight(weight) {
  return validateSignerWeight(weight).ok === true;
}
