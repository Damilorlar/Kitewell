import * as StellarSdk from "@stellar/stellar-sdk";

/**
 * Single source of truth for the Stellar networks the backend can serve.
 *
 * Every Horizon URL, network passphrase, explorer base, Friendbot URL and
 * Soroban RPC URL lives here, so `/health` and `/api/network` can never report
 * a passphrase that belongs to a different network than the URLs they expose.
 *
 * Futurenet has no official Friendbot, hence `friendbotUrl: null`.
 */
export const NETWORK_PRESETS = {
  TESTNET: {
    label: "Testnet",
    passphrase: StellarSdk.Networks.TESTNET,
    horizonUrl: "https://horizon-testnet.stellar.org",
    friendbotUrl: "https://friendbot.stellar.org",
    explorerBase: "https://stellar.expert/explorer/testnet",
    sorobanRpcUrl: "https://soroban-testnet.stellar.org",
  },
  FUTURENET: {
    label: "Futurenet",
    passphrase: StellarSdk.Networks.FUTURENET,
    horizonUrl: "https://horizon-futurenet.stellar.org",
    friendbotUrl: null,
    explorerBase: "https://stellar.expert/explorer/futurenet",
    sorobanRpcUrl: "https://rpc-futurenet.stellar.org",
  },
};

export const DEFAULT_NETWORK = "TESTNET";

/** Network ids accepted by `resolveNetwork`, in display order. */
export const SUPPORTED_NETWORKS = Object.keys(NETWORK_PRESETS);

/**
 * Prefer an explicit env value over the preset default. Blank and
 * whitespace-only values count as "unset" so an empty variable in a `.env`
 * file cannot blank out a URL that has a sensible default.
 */
function override(envValue, fallback) {
  if (typeof envValue !== "string") return fallback;
  const trimmed = envValue.trim();
  return trimmed === "" ? fallback : trimmed;
}

/**
 * Resolve the backend's network configuration.
 *
 * `NETWORK` selects the preset (default `TESTNET`, case-insensitive); each
 * individual URL can still be overridden through its `*_URL` / `*_BASE`
 * environment variable.
 *
 * @param {Record<string, string|undefined>} [env] Environment source; defaults
 *   to `process.env`.
 * @returns {{ network: string, passphrase: string, horizonUrl: string,
 *   friendbotUrl: string|null, explorerBase: string, sorobanRpcUrl: string }}
 * @throws {Error} When `NETWORK` names a network the backend does not support,
 *   so a misconfigured server fails fast at startup instead of silently
 *   serving Testnet URLs.
 */
/**
 * Resolve the network a single request asked for.
 *
 * Account and payment reads accept a caller-selected network so the frontend
 * can follow the header's Testnet / Futurenet switch. The default is Testnet
 * when the caller sends nothing, independent of the server's own `NETWORK`.
 *
 * @param {string|null|undefined} id Network id (`TESTNET` or `FUTURENET`,
 *   case-insensitive, trimmed). Blank, `null` and `undefined` mean Testnet.
 * @returns {{ network: string, label: string, passphrase: string,
 *   horizonUrl: string, friendbotUrl: string|null, explorerBase: string,
 *   sorobanRpcUrl: string }}
 * @throws {Error} When `id` names a network the backend does not support.
 */
export function resolveRequestNetwork(id) {
  if (id !== undefined && id !== null && typeof id !== "string") {
    throw new Error(
      `Unsupported network "${String(id)}". Supported networks: ${SUPPORTED_NETWORKS.join(", ")}.`,
    );
  }

  const requested = typeof id === "string" ? id.trim() : undefined;
  const network = (requested || DEFAULT_NETWORK).toUpperCase();
  const preset = NETWORK_PRESETS[network];

  if (!preset) {
    throw new Error(
      `Unsupported network "${requested}". Supported networks: ${SUPPORTED_NETWORKS.join(", ")}.`,
    );
  }

  return { network, ...preset };
}

export function resolveNetwork(env = process.env) {
  const requested =
    typeof env?.NETWORK === "string" ? env.NETWORK.trim() : undefined;
  const network = (requested || DEFAULT_NETWORK).toUpperCase();
  const preset = NETWORK_PRESETS[network];

  if (!preset) {
    throw new Error(
      `Unsupported NETWORK "${requested}". Supported networks: ${SUPPORTED_NETWORKS.join(", ")}.`,
    );
  }

  return {
    network,
    passphrase: preset.passphrase,
    horizonUrl: override(env?.HORIZON_URL, preset.horizonUrl),
    friendbotUrl: override(env?.FRIENDBOT_URL, preset.friendbotUrl),
    explorerBase: override(env?.EXPLORER_BASE, preset.explorerBase),
    sorobanRpcUrl: override(env?.SOROBAN_RPC_URL, preset.sorobanRpcUrl),
  };
}
