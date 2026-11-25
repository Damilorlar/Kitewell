import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Test that account sequence is loaded fresh before each transaction build.
 */

const { horizonServerMock, signTransactionMock } = vi.hoisted(() => ({
  horizonServerMock: {
    loadAccount: vi.fn(),
    submitTransaction: vi.fn(),
  },
  signTransactionMock: vi.fn(),
}));

vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(),
  setAllowed: vi.fn(),
  getAddress: vi.fn(),
  getNetwork: vi.fn(async () => {
    const { getActiveNetwork } = await import("./network");
    const active = getActiveNetwork();
    return { network: active.id, networkPassphrase: active.passphrase };
  }),
  signTransaction: signTransactionMock,
}));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: vi.fn(function () {
        return horizonServerMock;
      }),
    },
  };
});

const StellarSdk = await import("@stellar/stellar-sdk");
const { sendPaymentWithFreighter } = await import("./freighter");

describe("sequence loading", () => {
  const mockPublicKey = StellarSdk.Keypair.random().publicKey();
  const mockDestination = StellarSdk.Keypair.random().publicKey();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads account immediately before building transaction", async () => {
    const mockAccount = new StellarSdk.Account(mockPublicKey, "100");

    horizonServerMock.loadAccount.mockResolvedValue(mockAccount);
    horizonServerMock.submitTransaction.mockResolvedValue({
      hash: "tx-hash",
      successful: true,
    });

    const buildRealTx = (account) =>
      new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: mockDestination,
            asset: StellarSdk.Asset.native(),
            amount: "10",
          })
        )
        .setTimeout(180)
        .build();

    const tx = buildRealTx(mockAccount);
    signTransactionMock.mockResolvedValue({ signedTxXdr: tx.toXDR() });

    await sendPaymentWithFreighter(mockPublicKey, mockDestination, "10");

    // Should have called loadAccount to get fresh sequence
    expect(horizonServerMock.loadAccount).toHaveBeenCalledWith(mockPublicKey);
    expect(horizonServerMock.loadAccount).toHaveBeenCalledTimes(1);
  });
});
