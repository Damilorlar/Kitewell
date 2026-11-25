import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CI-friendly tests locking Horizon submit failures and the passphrase handed
 * to Freighter. Freighter and Horizon are mocked; the real SDK builds the
 * operation. The signing options must follow the active network.
 */

const { loadAccountMock, submitTransactionMock, signTransactionMock } =
  vi.hoisted(() => ({
    loadAccountMock: vi.fn(),
    submitTransactionMock: vi.fn(),
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
        return {
          loadAccount: loadAccountMock,
          submitTransaction: submitTransactionMock,
        };
      }),
    },
  };
});

const StellarSdk = await import("@stellar/stellar-sdk");
const { sendPaymentWithFreighter } = await import("./freighter");
const { setActiveNetwork } = await import("./network");

const SOURCE = StellarSdk.Keypair.random().publicKey();
const DESTINATION = StellarSdk.Keypair.random().publicKey();

beforeEach(() => {
  setActiveNetwork("TESTNET");
  vi.clearAllMocks();
  loadAccountMock.mockResolvedValue(new StellarSdk.Account(SOURCE, "1"));
  submitTransactionMock.mockResolvedValue({ hash: "submitoptshash", ledger: 3 });
  signTransactionMock.mockImplementation(async (xdr) => ({
    signedTxXdr: xdr,
  }));
});

afterEach(() => {
  setActiveNetwork("TESTNET");
});

describe("payment submit options", () => {
  it("propagates a Horizon submit failure unchanged", async () => {
    const submitError = new Error("Horizon submit failed");
    submitTransactionMock.mockRejectedValue(submitError);

    await expect(
      sendPaymentWithFreighter(SOURCE, DESTINATION, "10")
    ).rejects.toBe(submitError);
  });

  it("adds safe operation details to a Horizon transaction failure", async () => {
    const submitError = new Error("raw Horizon response");
    submitError.response = {
      data: {
        type: "https://stellar.org/horizon-errors/transaction_failed",
        extras: {
          result_codes: {
            transaction: "tx_failed",
            operations: ["op_underfunded"],
          },
          envelope_xdr: "signed secret xdr",
        },
      },
    };
    submitTransactionMock.mockRejectedValue(submitError);

    await expect(
      sendPaymentWithFreighter(SOURCE, DESTINATION, "10")
    ).rejects.toMatchObject({
      message: "Transaction failed on the network.",
      transactionFailure: {
        operations: [
          {
            index: 0,
            code: "op_underfunded",
            explanation: "Sending account does not have enough balance.",
          },
        ],
        transactionCode: "tx_failed",
      },
    });
  });

  it("signs on Testnet with the TESTNET passphrase and source address", async () => {
    await sendPaymentWithFreighter(SOURCE, DESTINATION, "10");

    expect(signTransactionMock).toHaveBeenCalledTimes(1);
    expect(signTransactionMock.mock.calls[0][1]).toEqual({
      networkPassphrase: StellarSdk.Networks.TESTNET,
      address: SOURCE,
    });
  });

  it("signs on Futurenet with the FUTURENET passphrase", async () => {
    setActiveNetwork("FUTURENET");

    await sendPaymentWithFreighter(SOURCE, DESTINATION, "10");

    expect(signTransactionMock.mock.calls[0][1].networkPassphrase).toBe(
      StellarSdk.Networks.FUTURENET
    );
  });
});
