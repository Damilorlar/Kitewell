/**
 * Read-only helpers for the sponsorships a connected account has given.
 *
 * Stellar reserves can be sponsored on two levels: a sponsored account
 * (`begin_sponsoring_future_reserves` + `create_account`) and a sponsored entry
 * such as a trustline or a data entry (`begin_sponsoring_future_reserves` +
 * the entry's own operation, submitted by the sponsored account). Horizon
 * reports both as one transaction, so the mapper below groups the operations
 * of each transaction and keeps only the transactions the connected account
 * opened with `begin_sponsoring_future_reserves`. A sponsorship received from
 * another account has that other account as the source, so it is skipped.
 */

/** Human labels for the entry a reserve sponsorship is supporting. */
const ENTRY_TYPE_LABELS = Object.freeze({
  create_account: "Account",
  change_trust: "Trustline",
  manage_data: "Data entry",
  manage_sell_offer: "Offer",
  manage_buy_offer: "Offer",
  create_passive_sell_offer: "Offer",
  payment: "Payment",
});

const BEGIN = "begin_sponsoring_future_reserves";
const END = "end_sponsoring_future_reserves";

/**
 * @param {string} operationType Horizon operation type
 * @returns {string} label shown in the account panel
 */
export function sponsorshipEntryType(operationType) {
  return ENTRY_TYPE_LABELS[operationType] || "Other entry";
}

function sponsoredTarget(operations, account) {
  return operations.find((operation) => {
    if (operation.type === BEGIN || operation.type === END) return false;
    const target = operation.account || operation.source_account;
    return Boolean(target) && target !== account;
  });
}

/**
 * Reduce the account's Horizon operations to one row per sponsorship given.
 *
 * @param {Array<object>} operations Horizon operation records
 * @param {string} account connected account (G…)
 * @returns {Array<{ sponsoredAccount: string, entryType: string }>}
 */
export function mapOutgoingSponsorships(operations, account) {
  if (!account || !Array.isArray(operations)) return [];

  const transactions = new Map();
  for (const operation of operations) {
    if (!operation || typeof operation !== "object") continue;
    const hash = operation.transaction_hash;
    if (!hash) continue;
    if (!transactions.has(hash)) transactions.set(hash, []);
    transactions.get(hash).push(operation);
  }

  const rows = [];
  const seen = new Set();
  for (const transaction of transactions.values()) {
    const startedByAccount = transaction.some(
      (operation) =>
        operation.type === BEGIN && operation.source_account === account
    );
    if (!startedByAccount) continue;

    const target = sponsoredTarget(transaction, account);
    const sponsoredAccount = target && (target.account || target.source_account);
    if (!sponsoredAccount) continue;

    const entryType = sponsorshipEntryType(target.type);
    const key = `${sponsoredAccount}:${entryType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ sponsoredAccount, entryType });
  }

  return rows;
}
