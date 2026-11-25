import { buildAsset } from "./stellar";
import { getActiveNetwork } from "./network";

/**
 * Horizon path-finding helpers for the Path tab.
 *
 * Both requests return the paths Horizon can route, so the sender picks a real
 * route instead of typing intermediate hops by hand. Nothing here signs or
 * submits; the picked path is handed to the existing path-payment builder.
 */

const CREDIT_ALPHANUM4 = "credit_alphanum4";
const CREDIT_ALPHANUM12 = "credit_alphanum12";

function assetType(asset) {
  if (asset.isNative()) return { type: "native" };
  return {
    type: asset.getCode().length <= 4 ? CREDIT_ALPHANUM4 : CREDIT_ALPHANUM12,
    code: asset.getCode(),
    issuer: asset.getIssuer(),
  };
}

/** Horizon asset query params for one side of a path request. */
function assetParams(asset, prefix) {
  const { type, code, issuer } = assetType(asset);
  const params = { [`${prefix}_asset_type`]: type };
  if (code) {
    params[`${prefix}_asset_code`] = code;
    params[`${prefix}_asset_issuer`] = issuer;
  }
  return params;
}

/**
 * Format an SDK Asset as the Path tab's hop syntax: `XLM` or `CODE:ISSUER`.
 */
export function formatPathHop(asset) {
  if (!asset) return "XLM";
  const native =
    typeof asset.isNative === "function" ? asset.isNative() : asset.isNative;
  if (native) return "XLM";

  const code = asset.getCode ? asset.getCode() : asset.code;
  const issuer = asset.getIssuer ? asset.getIssuer() : asset.issuer;
  return `${code}:${issuer}`;
}

/** Join Horizon's `path` array into the builder's comma-separated string. */
export function formatPathHops(path = []) {
  return path.map(formatPathHop).join(", ");
}

/** Map one Horizon path record into the shape the UI renders. */
function mapPathRecord(record) {
  return {
    sourceAmount: record.source_amount,
    destinationAmount: record.destination_amount,
    path: (record.path || []).map((hop) =>
      hop.asset_type === "native"
        ? { isNative: true, code: "XLM", issuer: null }
        : {
            isNative: false,
            code: hop.asset_code,
            issuer: hop.asset_issuer,
          }
    ),
  };
}

async function requestPaths(path, params, horizonUrl) {
  const query = new URLSearchParams(params).toString();
  const base = horizonUrl || getActiveNetwork().horizonUrl;
  const response = await fetch(`${base}${path}?${query}`);

  if (!response.ok) {
    throw new Error(`Horizon path lookup failed (HTTP ${response.status}).`);
  }

  const body = await response.json();
  return (body?._embedded?.records || []).map(mapPathRecord);
}

/**
 * Ask Horizon for strict-send paths: send `amount` of `sendAsset` and receive
 * at least the record's `destination_amount` of `destAsset`.
 *
 * @returns {Promise<Array<{sourceAmount: string, destinationAmount: string,
 *   path: Array<{isNative: boolean, code: string, issuer: string|null}>}>>}
 */
export async function fetchStrictSendPaths({
  sendAsset,
  destAsset,
  destination,
  amount,
  horizonUrl,
} = {}) {
  const source = buildAsset(sendAsset);
  const target = buildAsset(destAsset);

  return requestPaths(
    "/paths/strict-send",
    {
      ...assetParams(source, "source"),
      ...assetParams(target, "destination"),
      source_amount: String(amount),
      destination: destination,
    },
    horizonUrl
  );
}

/**
 * Ask Horizon for strict-receive paths: receive `amount` of `destAsset` and
 * spend at most the record's `source_amount` of `sendAsset`.
 */
export async function fetchStrictReceivePaths({
  sendAsset,
  destAsset,
  destination,
  amount,
  horizonUrl,
} = {}) {
  const source = buildAsset(sendAsset);
  const target = buildAsset(destAsset);

  return requestPaths(
    "/paths/strict-receive",
    {
      ...assetParams(source, "source"),
      ...assetParams(target, "destination"),
      destination_amount: String(amount),
      destination: destination,
    },
    horizonUrl
  );
}

/**
 * Mode-aware entry point used by the Path tab.
 *
 * @param {object} options
 * @param {"strictSend"|"strictReceive"} options.mode
 * @param {object} options.sendAsset UI asset descriptor
 * @param {object} options.destAsset UI asset descriptor
 * @param {string} options.destination Destination account
 * @param {string} options.amount Amount sent (strict send) or received
 *   (strict receive)
 * @param {string} [options.horizonUrl] Override; defaults to the active network
 */
export async function fetchPathQuote({
  mode,
  sendAsset,
  destAsset,
  destination,
  amount,
  horizonUrl,
} = {}) {
  if (mode === "strictReceive") {
    return fetchStrictReceivePaths({
      sendAsset,
      destAsset,
      destination,
      amount,
      horizonUrl,
    });
  }
  if (mode === "strictSend") {
    return fetchStrictSendPaths({
      sendAsset,
      destAsset,
      destination,
      amount,
      horizonUrl,
    });
  }
  throw new Error(`Unsupported path payment mode: ${mode}`);
}
