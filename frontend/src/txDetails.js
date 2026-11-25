/** Display helpers for one transaction's operations and effects (read-only). */

const OPERATION_NAMES = Object.freeze({
  create_account: "Create account",
  payment: "Payment",
  path_payment_strict_receive: "Path payment (strict receive)",
  path_payment_strict_send: "Path payment (strict send)",
  manage_sell_offer: "Manage sell offer",
  manage_buy_offer: "Manage buy offer",
  create_passive_sell_offer: "Create passive sell offer",
  set_options: "Set options",
  change_trust: "Change trust",
  allow_trust: "Allow trust",
  account_merge: "Account merge",
  manage_data: "Manage data",
  bump_sequence: "Bump sequence",
  create_claimable_balance: "Create claimable balance",
  claim_claimable_balance: "Claim claimable balance",
  begin_sponsoring_future_reserves: "Begin sponsoring future reserves",
  end_sponsoring_future_reserves: "End sponsoring future reserves",
  revoke_sponsorship: "Revoke sponsorship",
  clawback: "Clawback",
  clawback_claimable_balance: "Clawback claimable balance",
  set_trust_line_flags: "Set trustline flags",
  liquidity_pool_deposit: "Liquidity pool deposit",
  liquidity_pool_withdraw: "Liquidity pool withdraw",
  invoke_host_function: "Invoke contract function",
  extend_footprint_ttl: "Extend footprint TTL",
  restore_footprint: "Restore footprint",
});

function sentenceCase(snakeCase) {
  const text = String(snakeCase || "unknown").replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Human name for a Horizon operation type, e.g. `change_trust` -> `Change trust`. */
export function operationName(type) {
  return OPERATION_NAMES[type] || sentenceCase(type);
}

function assetLabel(record, prefix = "") {
  const type = record[`${prefix}asset_type`];
  if (type === "native") return "XLM";
  const code = record[`${prefix}asset_code`];
  return code || null;
}

/** One line describing a Horizon effect: its name plus account and amount. */
export function describeEffect(effect) {
  const parts = [sentenceCase(effect?.type)];
  const amount = effect?.amount;
  if (amount != null) {
    parts.push([amount, assetLabel(effect)].filter(Boolean).join(" "));
  }
  if (effect?.account) parts.push(effect.account);
  return parts.join(" · ");
}
