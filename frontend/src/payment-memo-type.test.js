import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CI-friendly tests locking the unsupported memo-type guard.
 * Freighter and Horizon are mocked; the real SDK builds the operation.
 * A non-empty memo value with a type other than text, id, or hash throws
 * before Horizon loadAccount.
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
  submitTransactionMock.mockResolvedValue({ hash: "memotypehash", ledger: 3 });
  signTransactionMock.mockImplementation(async (xdr) => ({
    signedTxXdr: xdr,
  }));
});

describe("unsupported memo type", () => {
  it("rejects a non-empty memo with an unknown type before loading the account", async () => {
    await expect(
      sendPaymentWithFreighter(SOURCE, DESTINATION, "10", null, "return", "x")
    ).rejects.toThrow("Unsupported memo type: return");

    expect(loadAccountMock).not.toHaveBeenCalled();
    expect(submitTransactionMock).not.toHaveBeenCalled();
    expect(signTransactionMock).not.toHaveBeenCalled();
  });
});
