/**
 * Pure helpers that map Horizon account balance records into the compact
 * shape the Kitewell API returns to the frontend.
 */

/**
 * Map a single Horizon balance record.
 *
 * @param {object} balance Horizon balance record (`asset_type`, `balance`, …).
 * @returns {object|null} Mapped balance, or `null` for malformed input.
 */
export function mapBalance(balance) {
  if (!balance || typeof balance !== "object") return null;

  if (balance.asset_type === "liquidity_pool_shares") {
    return {
      key: `pool:${balance.liquidity_pool_id}`,
      code: "POOL",
      issuer: null,
      balance: balance.balance,
      limit: null,
      isNative: false,
      isPoolShare: true,
      poolId: balance.liquidity_pool_id,
    };
  }

  if (balance.asset_type === "native") {
    return {
      key: "native",
      code: "XLM",
      issuer: null,
      balance: balance.balance,
      limit: null,
      isNative: true,
    };
  }

  return {
    key: `${balance.asset_code}:${balance.asset_issuer}`,
    code: balance.asset_code,
    issuer: balance.asset_issuer,
    balance: balance.balance,
    limit: balance.limit ?? null,
    isNative: false,
    isAuthorized:
      typeof balance.is_authorized === "boolean" ? balance.is_authorized : null,
    isAuthorizedToMaintainLiabilities:
      typeof balance.is_authorized_to_maintain_liabilities === "boolean"
        ? balance.is_authorized_to_maintain_liabilities
        : null,
    clawbackEnabled:
      typeof balance.clawback_enabled === "boolean" ? balance.clawback_enabled : null,
  };
}

/**
 * Map a list of Horizon balance records, preserving order and dropping
 * malformed entries.
 *
 * @param {object[]} balances Horizon balance records.
 * @returns {object[]} Mapped balances.
 */
export function mapBalances(balances) {
  if (!Array.isArray(balances)) return [];
  return balances.map(mapBalance).filter((mapped) => mapped !== null);
}
