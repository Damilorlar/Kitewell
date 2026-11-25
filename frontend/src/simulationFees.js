/**
 * Soroban simulation fee helpers.
 *
 * A simulation reports a resource fee (CPU, memory, ledger I/O) while the
 * inclusion fee is the classic per-operation fee. Showing one number hides
 * which part the user is about to sign, so the panel shows both in stroops and
 * marks a missing field as unavailable rather than as zero.
 *
 * @module simulationFees
 */

/**
 * Normalize a fee value to a stroop string.
 *
 * @param {unknown} value Fee from the simulation or transaction.
 * @returns {string|null} Non-negative integer string, or `null` when missing
 *   or malformed.
 */
function stroops(value) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  return /^\d+$/.test(text) ? text : null;
}

/**
 * Split a simulation result into its two fees.
 *
 * @param {object|null} simulation Soroban RPC simulateTransaction response.
 * @param {unknown} [inclusionFee] The fee of the simulated transaction (the
 *   classic inclusion fee), used when the response does not carry one.
 * @returns {{
 *   error: string|null,
 *   inclusionFee: string|null,
 *   resourceFee: string|null,
 *   totalFee: string|null,
 * }} Fees in stroops; `null` means the field was not reported.
 */
export function parseSimulationFees(simulation, inclusionFee = null) {
  if (!simulation || typeof simulation !== "object") {
    return { error: null, inclusionFee: null, resourceFee: null, totalFee: null };
  }

  if (simulation.error) {
    // A failed simulation reports no fee at all; do not show 0.
    return {
      error: String(simulation.error),
      inclusionFee: null,
      resourceFee: null,
      totalFee: null,
    };
  }

  const resourceFee = stroops(simulation.minResourceFee);
  const inclusion = stroops(
    simulation.inclusionFee ?? simulation.inclusion_fee ?? inclusionFee
  );

  const totalFee =
    resourceFee !== null && inclusion !== null
      ? (BigInt(resourceFee) + BigInt(inclusion)).toString()
      : null;

  return { error: null, inclusionFee: inclusion, resourceFee, totalFee };
}

/**
 * Render one fee field for the panel.
 *
 * @param {string|null|undefined} value Fee in stroops.
 * @returns {string} The stroop count or `"unavailable"`.
 */
export function formatSimulationFee(value) {
  return value === null || value === undefined ? "unavailable" : String(value);
}
