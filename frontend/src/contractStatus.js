/**
 * The state of a Soroban contract instance, as far as the Lab can tell before
 * it submits an RPC call.
 *
 * - `live`      the instance entry was read and is usable
 * - `archived`  the instance entry is archived, so every call would fail
 * - `unknown`   no read has completed, or the read failed (RPC unreachable),
 *               so the panel must not pretend the instance is live
 * - `missing`   no contract id is configured
 */
export const CONTRACT_STATUS = Object.freeze({
  LIVE: "live",
  ARCHIVED: "archived",
  UNKNOWN: "unknown",
  MISSING: "missing",
});

/**
 * Resolve the instance status from the last contract-state read.
 *
 * @param {object} input
 * @param {string|undefined} input.contractId contract id configured for the network
 * @param {{ archived?: boolean }|null} [input.state] last successful read
 * @param {string|Error|null} [input.error] error from the last read
 * @param {boolean} [input.rpcReachable] whether the Soroban RPC answered
 * @returns {string} one of CONTRACT_STATUS
 */
export function resolveContractStatus({
  contractId,
  state = null,
  error = null,
  rpcReachable = true,
}) {
  if (!contractId) return CONTRACT_STATUS.MISSING;
  if (!rpcReachable || error) return CONTRACT_STATUS.UNKNOWN;
  if (state?.archived) return CONTRACT_STATUS.ARCHIVED;
  if (state) return CONTRACT_STATUS.LIVE;
  return CONTRACT_STATUS.UNKNOWN;
}

const LABELS = Object.freeze({
  [CONTRACT_STATUS.LIVE]: "Live",
  [CONTRACT_STATUS.ARCHIVED]: "Archived",
  [CONTRACT_STATUS.UNKNOWN]: "Unknown — no RPC response",
  [CONTRACT_STATUS.MISSING]: "No contract instance",
});

/**
 * @param {string} status one of CONTRACT_STATUS
 * @returns {string} short label for the panel
 */
export function contractStatusLabel(status) {
  return LABELS[status] || LABELS[CONTRACT_STATUS.UNKNOWN];
}

/**
 * RPC calls are only allowed against a live instance.
 *
 * @param {string} status one of CONTRACT_STATUS
 * @returns {boolean}
 */
export function canCallContract(status) {
  return status === CONTRACT_STATUS.LIVE;
}

/**
 * Why the call button is disabled, or null when calls are allowed.
 *
 * @param {string} status one of CONTRACT_STATUS
 * @returns {string|null}
 */
export function rpcCallBlockReason(status) {
  switch (status) {
    case CONTRACT_STATUS.LIVE:
      return null;
    case CONTRACT_STATUS.ARCHIVED:
      return "This contract instance is archived — restore it before making RPC calls.";
    case CONTRACT_STATUS.MISSING:
      return "No contract id configured — deploy first (contracts/README.md).";
    default:
      return "The Soroban RPC did not respond, so the instance status is unknown. Calls are disabled until it recovers.";
  }
}
