/**
 * Liquidity-pool share helpers.
 *
 * A pool-share balance from Horizon is just a number of shares. To make a
 * withdraw meaningful the user needs the pool's two reserves, the total
 * shares, and the percentage of the pool they hold. These helpers turn a
 * Horizon liquidity-pool record into that view without touching the network,
 * and they truncate the percentage so it never claims more than the real share.
 *
 * @module poolShare
 */

const STROOPS_PER_UNIT = 7n;
const SCALE = 10n ** STROOPS_PER_UNIT;
const BASIS_POINTS = 10000n;

/**
 * Convert a decimal string of pool shares into stroops.
 *
 * @param {unknown} value Share amount ("12.3456789") or a bigint.
 * @returns {bigint|null} Stroops, or `null` for malformed input.
 */
function sharesToStroops(value) {
  if (typeof value === "bigint") return value >= 0n ? value : null;

  const text = String(value ?? "").trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return null;

  const [whole, fraction = ""] = text.split(".");
  const padded = (fraction + "0000000").slice(0, 7);
  return BigInt(whole) * SCALE + BigInt(padded);
}

/**
 * Percentage of a pool held by a share balance, truncated (never rounded up).
 *
 * @param {unknown} shares The account's pool shares.
 * @param {unknown} totalShares The pool's total shares.
 * @returns {string|null} Percentage with two decimals (e.g. `"33.33"`), or
 *   `null` when either value is malformed or the pool has no shares.
 */
export function poolSharePercentage(shares, totalShares) {
  const shareStroops = sharesToStroops(shares);
  const totalStroops = sharesToStroops(totalShares);

  if (shareStroops === null || totalStroops === null || totalStroops === 0n) {
    return null;
  }

  // Truncate at basis points: 1/3 becomes 33.33, never 33.34.
  const basisPoints = (shareStroops * BASIS_POINTS) / totalStroops;
  const whole = basisPoints / 100n;
  const fraction = String(basisPoints % 100n).padStart(2, "0");

  return `${whole}.${fraction}`;
}

/**
 * Label a pool reserve with its code and issuer.
 *
 * Horizon's liquidity-pool endpoint returns reserves as `"native"` or
 * `"CODE:ISSUER"` strings, while other callers pass asset objects. Both are
 * accepted.
 *
 * @param {unknown} asset Reserve asset from Horizon or an asset descriptor.
 * @returns {string|null} `"XLM (native)"`, `"CODE:ISSUER"`, or `null`.
 */
export function reserveAssetLabel(asset) {
  if (typeof asset === "string") {
    const text = asset.trim();
    if (!text) return null;
    if (/^(native|xlm)$/i.test(text)) return "XLM (native)";
    return text;
  }

  if (!asset || typeof asset !== "object") return null;

  if (asset.asset_type === "native" || asset.type === "native") {
    return "XLM (native)";
  }

  const code = asset.asset_code ?? asset.code;
  const issuer = asset.asset_issuer ?? asset.issuer;
  if (typeof code === "string" && code && typeof issuer === "string" && issuer) {
    return `${code}:${issuer}`;
  }

  return null;
}

/**
 * Build the display rows for every non-zero pool-share balance.
 *
 * `poolsById` maps a pool id to its Horizon record, `null` when Horizon could
 * not load it, or `undefined` while it is still loading.
 *
 * @param {object[]} balances Account balances, including pool-share entries.
 * @param {Record<string, object|null|undefined>} [poolsById] Loaded pools.
 * @returns {Array<{
 *   poolId: string,
 *   shares: string,
 *   totalShares: string|null,
 *   percentage: string|null,
 *   reserves: Array<{label: string, balance: string}>,
 *   reservesUnavailable: boolean,
 *   loading: boolean,
 * }>} One row per balance with a non-zero share count.
 */
export function poolShareRows(balances, poolsById = {}) {
  if (!Array.isArray(balances)) return [];

  const pools = poolsById && typeof poolsById === "object" ? poolsById : {};
  const rows = [];

  for (const balance of balances) {
    if (!balance || typeof balance !== "object") continue;
    if (!balance.isPoolShare || !balance.poolId) continue;

    const shareStroops = sharesToStroops(balance.balance);
    // A user with zero (or unreadable) shares does not get a row.
    if (shareStroops === null || shareStroops === 0n) continue;

    const pool = pools[balance.poolId];
    const loading = pool === undefined;
    const loaded = Boolean(pool) && typeof pool === "object";

    const reserves = [];
    if (loaded && Array.isArray(pool.reserves)) {
      for (const reserve of pool.reserves) {
        const label = reserveAssetLabel(reserve?.asset);
        if (!label) continue;
        reserves.push({ label, balance: reserve.balance ?? "—" });
      }
    }

    rows.push({
      poolId: balance.poolId,
      shares: String(balance.balance),
      totalShares: loaded ? pool.total_shares ?? null : null,
      percentage: loaded ? poolSharePercentage(balance.balance, pool.total_shares) : null,
      reserves,
      reservesUnavailable: pool === null || (loaded && reserves.length !== 2),
      loading,
    });
  }

  return rows;
}
