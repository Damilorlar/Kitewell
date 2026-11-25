const ASSET_CODE = /^[A-Za-z0-9]{1,12}$/;
const STELLAR_ACCOUNT_ID = /^G[A-Z2-7]{55}$/;

function assetParts(asset) {
  if (!asset || typeof asset !== "object") return null;

  let native;
  if (typeof asset.isNative === "function") {
    native = asset.isNative();
  } else if (typeof asset.isNative === "boolean") {
    native = asset.isNative;
  } else if (typeof asset.asset_type === "string") {
    if (asset.asset_type === "native") {
      native = true;
    } else if (
      asset.asset_type === "credit_alphanum4" ||
      asset.asset_type === "credit_alphanum12"
    ) {
      native = false;
    }
  }

  if (native === true) return { isNative: true };
  if (native !== false) return null;

  const code = asset.asset_code ?? asset.code;
  const issuer = asset.asset_issuer ?? asset.issuer;
  if (
    typeof code !== "string" ||
    !ASSET_CODE.test(code) ||
    typeof issuer !== "string" ||
    !STELLAR_ACCOUNT_ID.test(issuer)
  ) {
    return null;
  }

  return { isNative: false, code, issuer };
}

/**
 * Build a stable Map/Set key for a Horizon asset, UI descriptor, or SDK Asset.
 * Issued-asset keys preserve the asset code's spelling and use `CODE:ISSUER`.
 * Malformed or unsupported values return `null`.
 *
 * @param {object} asset Horizon record, `{ isNative, code, issuer }`, or SDK Asset.
 * @returns {string|null} `native`, `CODE:ISSUER`, or `null` for invalid input.
 */
export function buildAssetKey(asset) {
  const parts = assetParts(asset);
  if (!parts) return null;
  return parts.isNative ? "native" : `${parts.code}:${parts.issuer}`;
}

/** Return whether a value is exactly the canonical native asset key. */
export function isNativeAssetKey(key) {
  return key === "native";
}

/**
 * Parse a canonical asset key back into a UI descriptor.
 *
 * @param {string} key `native` or `CODE:ISSUER`.
 * @returns {{isNative: true}|{isNative: false, code: string, issuer: string}|null}
 */
export function splitAssetKey(key) {
  if (key === "native") return { isNative: true };
  if (typeof key !== "string") return null;

  const separator = key.indexOf(":");
  if (separator <= 0 || separator !== key.lastIndexOf(":")) return null;

  const code = key.slice(0, separator);
  const issuer = key.slice(separator + 1);
  if (!ASSET_CODE.test(code) || !STELLAR_ACCOUNT_ID.test(issuer)) return null;

  return { isNative: false, code, issuer };
}