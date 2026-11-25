import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CI-friendly tests locking the uint64 ceiling for id memos. 18446744073709551616
 * is 20 digits and one above the maximum. Freighter and Horizon are mocked; the
 * real SDK builds the operation.
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

const ABOVE_UINT64 = "18446744073709551616";

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockResolvedValue(new StellarSdk.Account(SOURCE, "1"));
  submitTransactionMock.mockResolvedValue({ hash: "overflowidhash", ledger: 3 });
  signTransactionMock.mockImplementation(async (xdr) => ({
    signedTxXdr: xdr,
  }));
});

describe("id memo rejects values above uint64", () => {
  it("rejects 18446744073709551616 before loading the account", async () => {
    expect(ABOVE_UINT64).toHaveLength(20);

    await expect(
      sendPaymentWithFreighter(SOURCE, DESTINATION, "10", null, "id", ABOVE_UINT64)
    ).rejects.toThrow("ID memos must be unsigned 64-bit integers.");

    expect(loadAccountMock).not.toHaveBeenCalled();
    expect(signTransactionMock).not.toHaveBeenCalled();
    expect(submitTransactionMock).not.toHaveBeenCalled();
  });
});
