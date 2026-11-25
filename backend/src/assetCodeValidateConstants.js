/**
 * Bounds and charset for a Stellar classic asset code.
 *
 * Classic asset codes are 1–12 characters drawn from uppercase A–Z and
 * digits 0–9 (alphanum4 is 1–4, alphanum12 is 5–12). This module records
 * those rules only. It does not import the Stellar SDK or talk to Horizon.
 */

/** Minimum accepted length, inclusive. A single character such as `A` is valid. */
export const ASSET_CODE_MIN_LENGTH = 1;

/** Maximum accepted length, inclusive. Twelve characters is the classic ceiling. */
export const ASSET_CODE_MAX_LENGTH = 12;

/**
 * Whole-string charset: uppercase ASCII letters and digits.
 * Lowercase, hyphen, underscore, space, and any other character fail.
 */
export const ASSET_CODE_CHARSET = /^[A-Z0-9]+$/;

/** Stable error strings returned by `validateAssetCode`. */
export const ASSET_CODE_ERROR = {
  TYPE: "Asset code must be a string",
  LENGTH: "Asset code must be between 1 and 12 characters",
  CHARSET: "Asset code must contain only uppercase A-Z and digits 0-9",
};
