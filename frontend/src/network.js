import * as StellarSdk from "@stellar/stellar-sdk";

/**
 * Single source of truth for the selectable Stellar networks.
 *
 * Every Horizon URL, network passphrase, explorer base and Friendbot URL lives
 * here so switching networks never requires touching transaction code.
 */
export const NETWORKS = {
  TESTNET: {
    id: "TESTNET",
    label: "Testnet",
    horizonUrl: "https://horizon-testnet.stellar.org",
    rpcUrl: "https://soroban-testnet.stellar.org",
    passphrase: StellarSdk.Networks.TESTNET,
    explorerBase: "https://stellar.expert/explorer/testnet",
    friendbotUrl: "https://friendbot.stellar.org",
  },
  FUTURENET: {
    id: "FUTURENET",
    label: "Futurenet",
    horizonUrl: "https://horizon-futurenet.stellar.org",
    rpcUrl: "https://rpc-futurenet.stellar.org",
    passphrase: StellarSdk.Networks.FUTURENET,
    explorerBase: "https://stellar.expert/explorer/futurenet",
    friendbotUrl: null,
  },
};

export const RPC_HEALTH_TIMEOUT_MS = 3000;

export function buildRpcServerUrl(horizonUrl) {
  try {
    const url = new URL(horizonUrl);
    url.pathname = "/";
    return url.toString().replace(/\/$/, "");
  } catch {
    return horizonUrl.replace(/\/$/, "");
  }
}

export function rpcIsReachable(health) {
  return Boolean(health && health.ok && health.status === "SUCCESS");
}

export function rpcDescription(health) {
  if (!health) return "unknown";
  if (health.status === "SUCCESS") return "reachable";
  if (health.status === "TIMEOUT") return "timeout";
  if (health.status === "ERROR") return "error";
  return health.status || "unknown";
}

/** Probe the Soroban RPC at the active network's Horizon endpoint for health
 * and the latest ledger. A timeout is an unreachable RPC, not a hung tab.
 *
 * @returns {{ ok: boolean, description: string, latestLedger: number|null,
 *   status: string|null, error: string|null }}
 */
export async function probeRpcHealth(horizonUrl,
  timeoutMs = RPC_HEALTH_TIMEOUT_MS) {
  const base = buildRpcServerUrl(horizonUrl);
  const results = await Promise.all([
    fetch(`${base}/rpc/method?request={"method":"getHealth"}`),
    fetch(
      `${base}/rpc/method?request={"method":"getLatestLedger"}`,
      { signal: AbortSignal.timeout(timeoutMs) }
    ),
  ]);

  const [healthRes, ledgerRes] = results;
  const health = healthRes.ok
    ? (await healthRes.json()).result?.body
    : null;

  let latestLedger = null;
  if (ledgerRes.ok) {
    const ledgerJson = await ledgerRes.json();
    latestLedger =
      ledgerJson.status === "SUCCESS" && typeof ledgerJson.result?.body === "number"
        ? ledgerJson.result.body
        : null;
  }

  if (healthRes.status === 200 && health && health.status === "SUCCESS") {
    return {
      ok: true,
      description: "reachable",
      latestLedger,
      status: health.status,
      error: null,
    };
  }

  const reason =
    ledgerRes.status === "abort" || ledgerRes.status === "timeout"
      ? "timeout"
      : healthRes.status !== 200
        ? "backend-health-unavailable"
        : "rpc-error";

  return {
    ok: false,
    description: "unreachable",
    latestLedger: null,
    status: null,
    error: `SOROBAN_RPC ${reason}: ${ledgerRes.status}`,
  };
}

export const DEFAULT_NETWORK_ID = "TESTNET";
export const NETWORK_STORAGE_KEY = "kitewell.network";
export const CUSTOM_NETWORK_STORAGE_KEY = "kitewell.customNetwork";

function normalizeHttpsUrl(value, field) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw new Error(`${field} must be a valid HTTPS URL.`);
  }
  if (url.protocol !== "https:") {
    throw new Error(`${field} must use HTTPS.`);
  }
  return url.toString().replace(/\/$/, "");
}

function readCustomNetwork() {
  try {
    const stored = globalThis.localStorage?.getItem(CUSTOM_NETWORK_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return {
      id: "CUSTOM",
      label: String(parsed.label || "").trim(),
      horizonUrl: normalizeHttpsUrl(parsed.horizonUrl, "Horizon URL"),
      rpcUrl: normalizeHttpsUrl(parsed.rpcUrl, "RPC URL"),
      passphrase: String(parsed.passphrase || "").trim(),
      explorerBase: null,
      friendbotUrl: null,
    };
  } catch {
    return null;
  }
}

let customNetwork = readCustomNetwork();

export function getAvailableNetworks() {
  return customNetwork ? [...Object.values(NETWORKS), customNetwork] : Object.values(NETWORKS);
}

export function getNetworkById(id) {
  return NETWORKS[id] || (id === "CUSTOM" ? customNetwork : null);
}

function readStoredNetworkId() {
  try {
    const stored = globalThis.localStorage?.getItem(NETWORK_STORAGE_KEY);
    return stored && getNetworkById(stored) ? stored : DEFAULT_NETWORK_ID;
  } catch {
    return DEFAULT_NETWORK_ID;
  }
}

let activeNetworkId = readStoredNetworkId();

export function getActiveNetworkId() {
  return activeNetworkId;
}

export function getActiveNetwork() {
  return getNetworkById(activeNetworkId);
}

export function isSupportedNetwork(id) {
  return Boolean(getNetworkById(id));
}

/** Switch the active network and persist the preference (best-effort). */
export function setActiveNetwork(id) {
  if (!isSupportedNetwork(id)) {
    throw new Error(`Unsupported network: ${id}`);
  }

  activeNetworkId = id;
  try {
    globalThis.localStorage?.setItem(NETWORK_STORAGE_KEY, id);
  } catch {
    /* persistence is optional; the in-memory switch still applies */
  }

  return getNetworkById(id);
}

export function saveCustomNetwork({ name, horizonUrl, rpcUrl, passphrase }) {
  const label = String(name || "").trim();
  const normalizedPassphrase = String(passphrase || "").trim();
  if (!label) throw new Error("Custom network name is required.");
  if (!normalizedPassphrase) throw new Error("Network passphrase is required.");

  customNetwork = {
    id: "CUSTOM",
    label,
    horizonUrl: normalizeHttpsUrl(horizonUrl, "Horizon URL"),
    rpcUrl: normalizeHttpsUrl(rpcUrl, "RPC URL"),
    passphrase: normalizedPassphrase,
    explorerBase: null,
    friendbotUrl: null,
  };
  try {
    globalThis.localStorage?.setItem(
      CUSTOM_NETWORK_STORAGE_KEY,
      JSON.stringify(customNetwork)
    );
  } catch {
    /* The in-memory custom network remains usable for this session. */
  }
  return customNetwork;
}

export function removeCustomNetwork() {
  customNetwork = null;
  try {
    globalThis.localStorage?.removeItem(CUSTOM_NETWORK_STORAGE_KEY);
  } catch {
    /* Storage cleanup is best-effort. */
  }
  if (activeNetworkId === "CUSTOM") return setActiveNetwork(DEFAULT_NETWORK_ID);
  return getActiveNetwork();
}

export function isFriendbotAvailable() {
  return Boolean(getActiveNetwork().friendbotUrl);
}

/** Look up a known network by its Stellar passphrase, or null if unknown. */
export function findNetworkByPassphrase(passphrase) {
  return (
    getAvailableNetworks().find((network) => network.passphrase === passphrase) ||
    null
  );
}
