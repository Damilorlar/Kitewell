/**
 * Resolve the display label and color token for a Stellar network id.
 *
 * Known ids (`testnet`, `futurenet`, `public`) map to a human-readable
 * label and a semantic color token for a UI badge. Unknown or falsy ids
 * fall back to a neutral "Unknown" label so callers never have to guard
 * against an unmapped network before rendering.
 *
 * @param {string|null|undefined} networkId
 * @returns {{ label: string, color: string }}
 */
export function resolveNetworkBadge(networkId) {
  const entry = NETWORK_BADGES[normalizeNetworkId(networkId)];
  return entry ? { ...entry } : { ...UNKNOWN_BADGE };
}

/**
 * Normalize a network id for lookup: trims whitespace and lowercases it.
 * Non-string input normalizes to an empty string.
 *
 * @param {string|null|undefined} networkId
 * @returns {string}
 */
export function normalizeNetworkId(networkId) {
  if (typeof networkId !== "string") return "";
  return networkId.trim().toLowerCase();
}

const UNKNOWN_BADGE = Object.freeze({ label: "Unknown", color: "gray" });

const NETWORK_BADGES = Object.freeze({
  testnet: Object.freeze({ label: "Testnet", color: "yellow" }),
  futurenet: Object.freeze({ label: "Futurenet", color: "purple" }),
  public: Object.freeze({ label: "Public", color: "green" }),
});
