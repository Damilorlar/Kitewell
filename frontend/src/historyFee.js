/**
 * Fee and operation count for a history row, read from the Horizon
 * transaction record that Horizon embeds in a payment (`join=transactions`).
 * Nothing here estimates a fee: a field the record does not carry stays null.
 */

const STROOPS_PER_XLM = 10_000_000n;

/** Parse a non-negative whole-number string or number; anything else is null. */
function parseWhole(value) {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : null;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return BigInt(value.trim());
  }
  return null;
}

/**
 * Pick the history fields out of a Horizon transaction record.
 *
 * `fee_charged` is the one figure the network took. For a fee-bump
 * transaction Horizon reports the outer fee there, and the inner transaction
 * keeps its own `max_fee` under `inner_transaction`, which is never read here,
 * so the two are not added together.
 *
 * @param {object|null|undefined} transaction Horizon transaction record.
 * @returns {{ fee_charged: string|null, operation_count: number|null,
 *   fee_bumped: boolean }}
 */
export function mapTransactionFee(transaction) {
  const record = transaction && typeof transaction === "object" ? transaction : {};
  const fee = parseWhole(record.fee_charged);
  const operations = parseWhole(record.operation_count);
  return {
    fee_charged: fee === null ? null : fee.toString(),
    operation_count: operations === null ? null : Number(operations),
    fee_bumped: Boolean(record.fee_bump_transaction || record.inner_transaction),
  };
}

/** Format a stroop amount as XLM with up to seven decimals, trailing zeros trimmed. */
function stroopsToXlm(stroops) {
  const whole = stroops / STROOPS_PER_XLM;
  const fraction = (stroops % STROOPS_PER_XLM).toString().padStart(7, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

/**
 * Format the fee and operation count line for a history row.
 *
 * @param {{ fee_charged?: unknown, operation_count?: unknown,
 *   fee_bumped?: unknown }} record A mapped history record.
 * @returns {string} For example `Fee 0.00001 XLM · 1 operation`; a missing fee
 *   reads `Fee unknown`, a missing count `operations unknown`, and a fee-bumped
 *   transaction adds `fee-bumped`.
 */
export function formatHistoryFee(record) {
  const fee = parseWhole(record?.fee_charged);
  const operations = parseWhole(record?.operation_count);

  const parts = [fee === null ? "Fee unknown" : `Fee ${stroopsToXlm(fee)} XLM`];
  if (record?.fee_bumped === true) parts.push("fee-bumped");
  parts.push(
    operations === null
      ? "operations unknown"
      : `${operations} ${operations === 1n ? "operation" : "operations"}`
  );
  return parts.join(" · ");
}
