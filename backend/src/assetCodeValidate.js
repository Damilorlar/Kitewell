import {
  ASSET_CODE_CHARSET,
  ASSET_CODE_ERROR,
  ASSET_CODE_MAX_LENGTH,
  ASSET_CODE_MIN_LENGTH,
} from "./assetCodeValidateConstants.js";

/**
 * Validate a Stellar classic asset code without the Horizon SDK.
 *
 * A code is valid when all of the following hold:
 * - the value is a string
 * - its length is from 1 through 12 inclusive
 * - every character is an uppercase `A-Z` letter or a digit `0-9`
 *
 * Lowercase letters, hyphens, underscores, spaces, the empty string, and
 * any non-string are invalid. Invalid input returns `{ ok: false, error }`
 * and never throws. This helper is standalone and is not wired into the
 * HTTP app.
 *
 * @param {unknown} code Candidate asset code.
 * @returns {{ ok: true, code: string } | { ok: false, error: string }}
 */
export function validateAssetCode(code) {
  if (typeof code !== "string") {
    return { ok: false, error: ASSET_CODE_ERROR.TYPE };
  }

  if (code.length < ASSET_CODE_MIN_LENGTH || code.length > ASSET_CODE_MAX_LENGTH) {
    return { ok: false, error: ASSET_CODE_ERROR.LENGTH };
  }

  if (!ASSET_CODE_CHARSET.test(code)) {
    return { ok: false, error: ASSET_CODE_ERROR.CHARSET };
  }

  return { ok: true, code };
}

/**
 * Boolean form of {@link validateAssetCode}.
 *
 * @param {unknown} code Candidate asset code.
 * @returns {boolean} `true` only when `validateAssetCode` returns `ok: true`.
 */
export function isValidAssetCode(code) {
  return validateAssetCode(code).ok === true;
}
