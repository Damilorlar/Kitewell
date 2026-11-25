const EXPLORER_BASES = Object.freeze({
  TESTNET: "https://stellar.expert/explorer/testnet",
  FUTURENET: "https://stellar.expert/explorer/futurenet",
  PUBLIC: "https://stellar.expert/explorer/public",
});

const TRANSACTION_HASH = /^[0-9a-fA-F]{64}$/;
const STELLAR_ACCOUNT_ID = /^[GC][A-Z2-7]{55}$/;

/**
 * Build a Stellar Expert URL for a transaction hash or account/contract ID.
 * Network names are case-insensitive; IDs are validated before URL creation.
 *
 * @param {string} network `TESTNET`, `FUTURENET`, or `PUBLIC`.
 * @param {"tx"|"account"} resourceType Explorer resource path.
 * @param {string} identifier Transaction hash or Stellar account/contract ID.
 * @returns {string} Absolute Stellar Expert URL.
 * @throws {TypeError|RangeError} When any input is invalid.
 */
export function buildExplorerUrl(network, resourceType, identifier) {
  if (typeof network !== "string" || !network.trim()) {
    throw new TypeError("Network is required.");
  }
  const normalizedNetwork = network.trim().toUpperCase();
  const base = EXPLORER_BASES[normalizedNetwork];
  if (!base) {
    throw new RangeError(`Unsupported network: ${normalizedNetwork}.`);
  }

  if (resourceType !== "tx" && resourceType !== "account") {
    throw new RangeError('Resource type must be "tx" or "account".');
  }
  if (typeof identifier !== "string" || !identifier) {
    throw new TypeError("Explorer identifier is required.");
  }

  const pattern = resourceType === "tx" ? TRANSACTION_HASH : STELLAR_ACCOUNT_ID;
  if (!pattern.test(identifier)) {
    throw new RangeError(
      resourceType === "tx"
        ? "Transaction hash must be 64 hexadecimal characters."
        : "Account ID must be a 56-character Stellar G... or C... ID."
    );
  }

  return `${base}/${resourceType}/${encodeURIComponent(identifier)}`;
}

/** Build a transaction explorer URL for a network. */
export function buildTransactionExplorerUrl(network, transactionHash) {
  return buildExplorerUrl(network, "tx", transactionHash);
}

/** Build an account explorer URL for a network. */
export function buildAccountExplorerUrl(network, accountId) {
  return buildExplorerUrl(network, "account", accountId);
}