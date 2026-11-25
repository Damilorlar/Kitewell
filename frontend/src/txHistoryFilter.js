/**
 * Filter an in-memory list of Horizon operations or payments.
 *
 * `filter.type` matches `record.type` exactly.
 * `filter.asset` matches `asset_code`, or native XLM when the value is `"native"` or `"XLM"`.
 * `filter.direction` matches sent or received payments for `filter.publicKey`.
 * `filter.from` and `filter.to` are inclusive ISO timestamps compared with `created_at`.
 * The input array is not mutated.
 *
 * @param {unknown} records Horizon operation or payment records
 * @param {{
 *   type?: string, asset?: string, direction?: "sent"|"received",
 *   publicKey?: string, from?: string, to?: string
 * }} [filter]
 * @returns {object[]} Records that match every provided criterion
 * @throws {TypeError} When records, filter, or a date is invalid
 * @throws {RangeError} When `from` is later than `to`
 */
export function filterTransactionHistory(records, filter = {}) {
  if (!Array.isArray(records)) {
    throw new TypeError("records must be an array");
  }

  if (filter == null || typeof filter !== "object" || Array.isArray(filter)) {
    throw new TypeError("filter must be an object");
  }

  const type = filter.type ?? null;
  const asset = filter.asset ?? null;
  const direction = filter.direction ?? null;
  const publicKey = filter.publicKey ?? null;

  if (type != null && typeof type !== "string") {
    throw new TypeError("type must be a string");
  }

  if (asset != null && typeof asset !== "string") {
    throw new TypeError("asset must be a string");
  }
  if (direction != null && !["sent", "received"].includes(direction)) {
    throw new TypeError("direction must be sent or received");
  }
  if (publicKey != null && typeof publicKey !== "string") {
    throw new TypeError("publicKey must be a string");
  }
  if (direction != null && !publicKey) {
    throw new TypeError("publicKey is required when filtering by direction");
  }

  const from = filter.from == null ? null : parseInstant(filter.from, "from");
  const to = filter.to == null ? null : parseInstant(filter.to, "to");

  if (from != null && to != null && from > to) {
    throw new RangeError("from is after to");
  }

  return records.filter((record) => {
    if (!record || typeof record !== "object") {
      throw new TypeError("each record must be an object");
    }

    if (type != null && record.type !== type) return false;
    if (asset != null && !matchesAsset(record, asset)) return false;
    if (direction === "sent" && record.from !== publicKey) return false;
    if (
      direction === "received" &&
      (record.from === publicKey || record.to !== publicKey)
    ) {
      return false;
    }

    if (from != null || to != null) {
      const created = parseInstant(record.created_at, "created_at");
      if (from != null && created < from) return false;
      if (to != null && created > to) return false;
    }

    return true;
  });
}

function parseInstant(value, label) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new TypeError(`${label} must be an ISO date string`);
  }

  return Date.parse(value);
}

function matchesAsset(record, asset) {
  if (asset === "native" || asset === "XLM") return record.asset_type === "native";
  return record.asset_code === asset;
}
