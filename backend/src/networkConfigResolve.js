import { NetworkConfigError } from "./networkConfigResolveErrors.js";

/**
 * Exact, case-sensitive network names this resolver accepts.
 * @type {readonly ["testnet", "public"]}
 */
export const SUPPORTED_NETWORK_NAMES = Object.freeze(["testnet", "public"]);

const NETWORK_PRESETS = {
  testnet: {
    horizonUrl: "https://horizon-testnet.stellar.org",
    passphrase: "Test SDF Network ; September 2015",
    friendbotUrl: "https://friendbot.stellar.org",
  },
  public: {
    horizonUrl: "https://horizon.stellar.org",
    passphrase: "Public Global Stellar Network ; September 2015",
    friendbotUrl: null,
  },
};

/**
 * Resolve a network name to Horizon URL, passphrase, and Friendbot URL.
 *
 * Accepts only the exact strings `testnet` and `public`. The match is
 * case-sensitive and is not trimmed: `TESTNET`, `futurenet`, `""`, and
 * whitespace-only strings are rejected. `null` and any non-string throw the
 * same error.
 *
 * Public has no Friendbot, so `friendbotUrl` is `null`. The returned object
 * is a copy; mutating it does not change later lookups.
 *
 * This module is standalone. It is not imported by the HTTP app.
 *
 * @param {string} name Network name (`testnet` or `public`).
 * @returns {{ horizonUrl: string, passphrase: string, friendbotUrl: string|null }}
 * @throws {NetworkConfigError} When `name` is missing, the wrong type, or not
 *   a supported network. `code` is `unsupported_network` and `input` is the
 *   original argument.
 */
export function resolveNetworkConfig(name) {
  if (typeof name !== "string" || !Object.hasOwn(NETWORK_PRESETS, name)) {
    throw new NetworkConfigError(name);
  }

  const preset = NETWORK_PRESETS[name];
  return {
    horizonUrl: preset.horizonUrl,
    passphrase: preset.passphrase,
    friendbotUrl: preset.friendbotUrl,
  };
}

export { NetworkConfigError };
