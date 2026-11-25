/**
 * Build the payload for `GET /health` from already-known inputs.
 *
 * This function does not probe Horizon and is not imported by the server.
 *
 * @param {{
 *   uptimeSeconds: number,
 *   network: string,
 *   horizonReachable: boolean,
 *   checkedAt?: string
 * }} input
 * @returns {{
 *   status: "ok" | "degraded",
 *   uptimeSeconds: number,
 *   network: string,
 *   horizonReachable: boolean,
 *   checkedAt: string
 * }}
 * @throws {TypeError} When a field is missing or out of range
 */
export function buildHealthSnapshot(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("input must be an object");
  }

  const { uptimeSeconds, network, horizonReachable, checkedAt } = input;

  if (typeof uptimeSeconds !== "number" || !Number.isFinite(uptimeSeconds) || uptimeSeconds < 0) {
    throw new TypeError("uptimeSeconds must be a non-negative finite number");
  }

  if (typeof network !== "string" || network.trim() === "") {
    throw new TypeError("network must be a non-empty string");
  }

  if (typeof horizonReachable !== "boolean") {
    throw new TypeError("horizonReachable must be a boolean");
  }

  if (checkedAt != null && (typeof checkedAt !== "string" || Number.isNaN(Date.parse(checkedAt)))) {
    throw new TypeError("checkedAt must be an ISO date string");
  }

  return {
    status: horizonReachable ? "ok" : "degraded",
    uptimeSeconds,
    network,
    horizonReachable,
    checkedAt: checkedAt ?? new Date().toISOString(),
  };
}
