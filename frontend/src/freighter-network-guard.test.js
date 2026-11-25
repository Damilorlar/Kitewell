import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Issue #535: block Freighter signing when the wallet network differs from
 * the lab's selected network. Match must proceed with no extra confirm.
 */

const {
  loadAccountMock,
  submitTransactionMock,
  signTransactionMock,
  getNetworkMock,
  ledgerCallMock,
} = vi.hoisted(() => ({
  loadAccountMock: vi.fn(),
  submitTransactionMock: vi.fn(),
  signTransactionMock: vi.fn(),
  getNetworkMock: vi.fn(),
  ledgerCallMock: vi.fn(),
}));

vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(),
  setAllowed: vi.fn(),
  getAddress: vi.fn(),
  getNetwork: getNetworkMock,
  signTransaction: signTransactionMock,
}));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: vi.fn(function () {
        return {
          loadAccount: loadAccountMock,
          submitTransaction: submitTransactionMock,
          ledgers: () => ({
            order: () => ({
              limit: () => ({ call: ledgerCallMock }),
            }),
          }),
        };
      }),
    },
  };
});

const StellarSdk = await import("@stellar/stellar-sdk");
const { changeTrustWithFreighter } = await import("./freighter");
const { DEFAULT_NETWORK_ID, setActiveNetwork } = await import("./network");

const SOURCE = StellarSdk.Keypair.random().publicKey();
const ISSUER = StellarSdk.Keypair.random().publicKey();

beforeEach(() => {
  vi.clearAllMocks();
  setActiveNetwork(DEFAULT_NETWORK_ID);
  const account = new StellarSdk.Account(SOURCE, "1");
  account.subentry_count = 0;
  account.balances = [{ asset_type: "native", balance: "100.0000000" }];
  loadAccountMock.mockResolvedValue(account);
  submitTransactionMock.mockResolvedValue({ hash: "ok", ledger: 1 });
  ledgerCallMock.mockResolvedValue({
    records: [{ base_reserve_in_stroops: "5000000" }],
  });
  signTransactionMock.mockImplementation(async (xdr) => ({
    signedTxXdr: xdr,
  }));
});

afterEach(() => {
  setActiveNetwork(DEFAULT_NETWORK_ID);
});

describe("Freighter network guard", () => {
  it("blocks signing when Freighter and the lab disagree, naming both networks", async () => {
    setActiveNetwork("FUTURENET");
    getNetworkMock.mockResolvedValue({
      network: "TESTNET",
      networkPassphrase: StellarSdk.Networks.TESTNET,
    });

    await expect(
      changeTrustWithFreighter(SOURCE, "USDC", ISSUER)
    ).rejects.toThrow(
      "Freighter is on Testnet but the lab is on Futurenet. Switch either side to match before signing."
    );
    expect(signTransactionMock).not.toHaveBeenCalled();
  });

  it("allows signing when Freighter and the lab match, with no extra confirm", async () => {
    getNetworkMock.mockResolvedValue({
      network: "TESTNET",
      networkPassphrase: StellarSdk.Networks.TESTNET,
    });

    await changeTrustWithFreighter(SOURCE, "USDC", ISSUER);

    expect(signTransactionMock).toHaveBeenCalledTimes(1);
    expect(submitTransactionMock).toHaveBeenCalledTimes(1);
  });

  it("clears the block when either side switches to match, without a reload", async () => {
    setActiveNetwork("FUTURENET");
    getNetworkMock.mockResolvedValue({
      network: "TESTNET",
      networkPassphrase: StellarSdk.Networks.TESTNET,
    });

    await expect(
      changeTrustWithFreighter(SOURCE, "USDC", ISSUER)
    ).rejects.toThrow(/Freighter is on Testnet/);

    // Lab switches to Freighter's network — live check, no reload needed.
    setActiveNetwork("TESTNET");
    await changeTrustWithFreighter(SOURCE, "USDC", ISSUER);
    expect(signTransactionMock).toHaveBeenCalledTimes(1);

    // Freighter switches to the lab's Futurenet instead.
    setActiveNetwork("FUTURENET");
    getNetworkMock.mockResolvedValue({
      network: "FUTURENET",
      networkPassphrase: StellarSdk.Networks.FUTURENET,
    });
    await changeTrustWithFreighter(SOURCE, "USDC", ISSUER);
    expect(signTransactionMock).toHaveBeenCalledTimes(2);
  });
});
