/**
 * Calculate whether a set of selected signers meets the account thresholds.
 *
 * @param {Array} signers - Array of signer objects with { key, weight, type }
 * @param {Array} selectedKeys - Array of public keys that are "ticked"
 * @param {Object} thresholds - { low, medium, high } from Horizon
 * @returns {Object} { totalWeight, low, medium, high, canMeetHigh }
 */
export function checkThresholds(signers, selectedKeys, thresholds) {
  const selectedSet = new Set(selectedKeys);
  
  // Calculate total weight of selected signers
  const totalWeight = signers
    .filter((signer) => selectedSet.has(signer.key) && signer.weight > 0)
    .reduce((sum, signer) => sum + signer.weight, 0);

  // Check if selected signers meet each threshold
  const low = totalWeight >= thresholds.low;
  const medium = totalWeight >= thresholds.medium;
  const high = totalWeight >= thresholds.high;

  // Check if ANY subset of existing signers can meet the high threshold
  const maxPossibleWeight = signers
    .filter((signer) => signer.weight > 0)
    .reduce((sum, signer) => sum + signer.weight, 0);
  
  const canMeetHigh = maxPossibleWeight >= thresholds.high;

  return {
    totalWeight,
    low,
    medium,
    high,
    canMeetHigh,
  };
}
