/**
 * Sort a Horizon balances array for display.
 *
 * Native XLM (`asset_type === "native"`) stays pinned first. Every other
 * balance is ordered alphabetically by `asset_code`. The input array is not
 * mutated. Equal codes keep their original order.
 *
 * @param {unknown} balances Horizon `balances` array
 * @returns {object[]} New array, native first, then asset code A–Z
 * @throws {TypeError} When `balances` is not an array or an entry is not an object
 */
export function sortBalances(balances) {
  if (!Array.isArray(balances)) {
    throw new TypeError("balances must be an array");
  }

  const copy = balances.slice();

  for (const entry of copy) {
    if (!entry || typeof entry !== "object") {
      throw new TypeError("each balance must be an object");
    }
  }

  copy.sort((left, right) => {
    const leftNative = left.asset_type === "native";
    const rightNative = right.asset_type === "native";

    if (leftNative !== rightNative) return leftNative ? -1 : 1;

    const leftCode = typeof left.asset_code === "string" ? left.asset_code : "";
    const rightCode = typeof right.asset_code === "string" ? right.asset_code : "";
    return leftCode.localeCompare(rightCode);
  });

  return copy;
}
