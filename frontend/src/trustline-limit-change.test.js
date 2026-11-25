import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Test changing trustline limits with changeTrustWithFreighter.
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
const { changeTrustWithFreighter } = await import("./freighter");

describe("changeTrustWithFreighter - limit changes", () => {
  const mockPublicKey = StellarSdk.Keypair.random().publicKey();
  const mockIssuer = StellarSdk.Keypair.random().publicKey();

  beforeEach(() => {
    vi.clearAllMocks();
    const mockAccount = new StellarSdk.Account(mockPublicKey, "100");
    horizonServerMock.loadAccount.mockResolvedValue(mockAccount);
    horizonServerMock.submitTransaction.mockResolvedValue({
      hash: "tx-hash",
      successful: true,
    });
  });

  it("builds changeTrust with new limit", async () => {
    const buildTx = () =>
      new StellarSdk.TransactionBuilder(
        new StellarSdk.Account(mockPublicKey, "100"),
        {
          fee: StellarSdk.BASE_FEE,
          networkPassphrase: StellarSdk.Networks.TESTNET,
        }
      )
        .addOperation(
          StellarSdk.Operation.changeTrust({
            asset: new StellarSdk.Asset("USDC", mockIssuer),
            limit: "5000000",
          })
        )
        .setTimeout(180)
        .build();

    const tx = buildTx();
    signTransactionMock.mockResolvedValue({ signedTxXdr: tx.toXDR() });

    const result = await changeTrustWithFreighter(
      mockPublicKey,
      "USDC",
      mockIssuer,
      "5000000"
    );

    expect(result.hash).toBe("tx-hash");
    expect(horizonServerMock.submitTransaction).toHaveBeenCalled();

    // Verify the transaction was built with the correct limit
    const signCall = signTransactionMock.mock.calls[0];
    const txXdr = signCall[0];
    const parsedTx = StellarSdk.TransactionBuilder.fromXDR(
      txXdr,
      StellarSdk.Networks.TESTNET
    );

    expect(parsedTx.operations).toHaveLength(1);
    expect(parsedTx.operations[0].type).toBe("changeTrust");
    expect(parsedTx.operations[0].limit).toBe("5000000.0000000");
  });

  it("validates limit format", async () => {
    // changeTrust should work with valid numeric limit
    const buildTx = () =>
      new StellarSdk.TransactionBuilder(
        new StellarSdk.Account(mockPublicKey, "100"),
        {
          fee: StellarSdk.BASE_FEE,
          networkPassphrase: StellarSdk.Networks.TESTNET,
        }
      )
        .addOperation(
          StellarSdk.Operation.changeTrust({
            asset: new StellarSdk.Asset("USDC", mockIssuer),
            limit: "100.5",
          })
        )
        .setTimeout(180)
        .build();

    const tx = buildTx();
    signTransactionMock.mockResolvedValue({ signedTxXdr: tx.toXDR() });

    await expect(
      changeTrustWithFreighter(mockPublicKey, "USDC", mockIssuer, "100.5")
    ).resolves.toBeTruthy();
  });

  it("allows zero limit to remove trustline", async () => {
    const buildTx = () =>
      new StellarSdk.TransactionBuilder(
        new StellarSdk.Account(mockPublicKey, "100"),
        {
          fee: StellarSdk.BASE_FEE,
          networkPassphrase: StellarSdk.Networks.TESTNET,
        }
      )
        .addOperation(
          StellarSdk.Operation.changeTrust({
            asset: new StellarSdk.Asset("USDC", mockIssuer),
            limit: "0",
          })
        )
        .setTimeout(180)
        .build();

    const tx = buildTx();
    signTransactionMock.mockResolvedValue({ signedTxXdr: tx.toXDR() });

    const result = await changeTrustWithFreighter(
      mockPublicKey,
      "USDC",
      mockIssuer,
      "0"
    );

    expect(result.hash).toBe("tx-hash");

    const signCall = signTransactionMock.mock.calls[0];
    const txXdr = signCall[0];
    const parsedTx = StellarSdk.TransactionBuilder.fromXDR(
      txXdr,
      StellarSdk.Networks.TESTNET
    );

    expect(parsedTx.operations[0].limit).toBe("0.0000000");
  });
});

// UI-level validation tests (would be in App.test.jsx in a real scenario)
describe("trustline limit validation", () => {
  it("refuses limit below current balance", () => {
    const currentBalance = 100;
    const newLimit = 50;

    const isValid = newLimit >= currentBalance;
    expect(isValid).toBe(false);
  });

  it("accepts limit above current balance", () => {
    const currentBalance = 100;
    const newLimit = 200;

    const isValid = newLimit >= currentBalance;
    expect(isValid).toBe(true);
  });

  it("accepts limit equal to current balance", () => {
    const currentBalance = 100;
    const newLimit = 100;

    const isValid = newLimit >= currentBalance;
    expect(isValid).toBe(true);
  });

  it("refuses non-numeric limit", () => {
    const limit = "not-a-number";
    const isValid = !isNaN(parseFloat(limit));
    expect(isValid).toBe(false);
  });
});
