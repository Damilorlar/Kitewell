import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CI-friendly tests locking payment signing errors.
 * Freighter and Horizon are mocked; the real SDK builds the operation.
 * `signAndSubmit` surfaces the Freighter error message, or the fallback
 * "Transaction signing was rejected in Freighter.", and never submits.
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

const SOURCE = StellarSdk.Keypair.random().publicKey();
const DESTINATION = StellarSdk.Keypair.random().publicKey();

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockResolvedValue(new StellarSdk.Account(SOURCE, "1"));
  submitTransactionMock.mockResolvedValue({ hash: "signhash", ledger: 3 });
  signTransactionMock.mockImplementation(async (xdr) => ({
    signedTxXdr: xdr,
  }));
});

describe("payment signing errors", () => {
  it("surfaces the Freighter error message and does not submit", async () => {
    signTransactionMock.mockResolvedValue({
      error: { message: "User declined" },
    });

    await expect(
      sendPaymentWithFreighter(SOURCE, DESTINATION, "10")
    ).rejects.toThrow("User declined");

    expect(submitTransactionMock).not.toHaveBeenCalled();
  });

  it("falls back to the rejection message and does not submit", async () => {
    signTransactionMock.mockResolvedValue({ error: {} });

    await expect(
      sendPaymentWithFreighter(SOURCE, DESTINATION, "10")
    ).rejects.toThrow("Transaction signing was rejected in Freighter.");

    expect(submitTransactionMock).not.toHaveBeenCalled();
  });
});
