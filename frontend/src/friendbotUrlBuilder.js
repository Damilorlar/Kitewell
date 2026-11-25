/**
 * Friendbot URL builder.
 *
 * Friendbot is the Stellar faucet that funds a new account on development
 * networks. This module turns a network plus a Stellar address into the
 * funding URL `<friendbotBase>?addr=<address>`, and refuses networks that have
 * no faucet (the public network).
 *
 * It is deliberately standalone: it does not read the network store, call the
 * SDK, or touch the DOM, so the later wallet-integration issue can import it
 * without side effects. Every failure throws an `Error` with a user-facing
 * message, matching the throw-based helpers elsewhere in `frontend/src`.
 */

/** Friendbot base URLs for networks that run a faucet. */
export const FRIENDBOT_URLS = Object.freeze({
  TESTNET: "https://friendbot.stellar.org",
  FUTURENET: "https://friendbot-futurenet.stellar.org",
});

/** Networks that are known to have no Friendbot. */
export const NETWORKS_WITHOUT_FRIENDBOT = Object.freeze(["PUBLIC", "MAINNET"]);

const NETWORK_LABELS = Object.freeze({
  TESTNET: "Testnet",
  FUTURENET: "Futurenet",
  PUBLIC: "Public",
  MAINNET: "Public",
});

/**
 * Canonical shape of a Stellar ed25519 public key. The StrKey checksum is not
 * verified here — that is left to the SDK at submission time.
 */
const STELLAR_ADDRESS = /^G[A-Z2-7]{55}$/;

/** Trim and uppercase a network id so `testnet` and `TESTNET` are equivalent. */
function normalizeNetworkId(network) {
  return network.trim().toUpperCase();
}

/**
 * Resolve the Friendbot base URL for a network id or network descriptor.
 *
 * A descriptor is any object with a `friendbotUrl` string (for example an
 * entry of `NETWORKS` in `./network`) and an optional `id`/`label` used in
 * error messages.
 *
 * @param {string|object} network network id (`"TESTNET"`) or descriptor
 * @returns {string} base URL without a trailing slash
 * @throws {Error} when the network is missing, unknown, or has no Friendbot
 */
function resolveFriendbotBase(network) {
  if (
    network === null ||
    network === undefined ||
    (typeof network === "string" && !network.trim())
  ) {
    throw new Error("Network is required.");
  }

  if (typeof network === "string") {
    const id = normalizeNetworkId(network);

    if (NETWORKS_WITHOUT_FRIENDBOT.includes(id)) {
      throw new Error(`Friendbot is not available on ${NETWORK_LABELS[id]}.`);
    }

    const base = FRIENDBOT_URLS[id];
    if (!base) {
      throw new Error(`Unknown network: ${id}.`);
    }

    return base;
  }

  if (typeof network === "object") {
    const base =
      typeof network.friendbotUrl === "string" ? network.friendbotUrl.trim() : "";

    if (!base) {
      const id =
        typeof network.id === "string" ? normalizeNetworkId(network.id) : "";
      const label = network.label || NETWORK_LABELS[id] || id || "this network";
      throw new Error(`Friendbot is not available on ${label}.`);
    }

    return base.replace(/\/+$/, "");
  }

  throw new Error("Network must be a network id or descriptor.");
}

/**
 * Validate and trim a Stellar address before it is put in a URL.
 *
 * @param {string} address
 * @returns {string} the trimmed address
 * @throws {Error} when the address is missing or not a G... public key
 */
function normalizeAddress(address) {
  if (typeof address !== "string") {
    throw new Error("A Stellar address is required.");
  }

  const value = address.trim();

  if (!value) {
    throw new Error("A Stellar address is required.");
  }

  if (!STELLAR_ADDRESS.test(value)) {
    throw new Error("Invalid Stellar address. Expected a G... public key.");
  }

  return value;
}

/**
 * Whether a network runs a Friendbot faucet.
 *
 * Never throws: missing, unknown, or faucet-less networks return `false`.
 *
 * @param {string|object|null|undefined} network network id or descriptor
 * @returns {boolean}
 */
export function isFriendbotSupported(network) {
  if (typeof network === "string") {
    if (!network.trim()) return false;
    return Boolean(FRIENDBOT_URLS[normalizeNetworkId(network)]);
  }

  if (network && typeof network === "object") {
    return typeof network.friendbotUrl === "string" && Boolean(network.friendbotUrl.trim());
  }

  return false;
}

/**
 * Build a Friendbot funding URL.
 *
 * The address is trimmed and URL-encoded; a trailing slash on a custom
 * descriptor's `friendbotUrl` is removed so the query string is never doubled
 * up.
 *
 * @param {string|object} network network id (`"TESTNET"`) or descriptor with a
 *   `friendbotUrl`
 * @param {string} address Stellar G... public key
 * @returns {string} funding URL, e.g.
 *   `https://friendbot.stellar.org?addr=GABC...`
 * @throws {Error} when the network has no Friendbot or the address is invalid
 */
export function buildFriendbotUrl(network, address) {
  const base = resolveFriendbotBase(network);
  const value = normalizeAddress(address);

  return `${base}?addr=${encodeURIComponent(value)}`;
}
