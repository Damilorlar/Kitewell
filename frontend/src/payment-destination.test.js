import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CI-friendly tests locking the destination check on a direct payment.
 * Freighter and Horizon are mocked; the real SDK builds the operation.
 * An invalid destination throws before Horizon loadAccount / submitTransaction.
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
const INVALID_DESTINATION = "not-a-key";

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockResolvedValue(new StellarSdk.Account(SOURCE, "1"));
  submitTransactionMock.mockResolvedValue({ hash: "desthash", ledger: 3 });
  signTransactionMock.mockImplementation(async (xdr) => ({
    signedTxXdr: xdr,
  }));
});

describe("invalid payment destination", () => {
  it("rejects a malformed destination before loading the account or submitting", async () => {
    await expect(
      sendPaymentWithFreighter(SOURCE, INVALID_DESTINATION, "10")
    ).rejects.toThrow("Destination must be a valid Stellar public key (G…).");

    expect(loadAccountMock).not.toHaveBeenCalled();
    expect(submitTransactionMock).not.toHaveBeenCalled();
    expect(signTransactionMock).not.toHaveBeenCalled();
  });
});
