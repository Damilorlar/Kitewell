import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CI-friendly tests locking an over-long text memo off the payment.
 * Freighter and Horizon are mocked; the real SDK builds the operation.
 * Memo validation runs before Horizon loadAccount.
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

const TOO_LONG_TEXT_MEMO = "a".repeat(29);

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockResolvedValue(new StellarSdk.Account(SOURCE, "1"));
  submitTransactionMock.mockResolvedValue({ hash: "memo29hash", ledger: 3 });
  signTransactionMock.mockImplementation(async (xdr) => ({
    signedTxXdr: xdr,
  }));
});

describe("text memo over 28 bytes", () => {
  it("rejects a 29-character text memo before loading the account", async () => {
    await expect(
      sendPaymentWithFreighter(
        SOURCE,
        DESTINATION,
        "10",
        null,
        "text",
        TOO_LONG_TEXT_MEMO
      )
    ).rejects.toThrow("Text memos must be 28 UTF-8 bytes or fewer.");

    expect(loadAccountMock).not.toHaveBeenCalled();
    expect(submitTransactionMock).not.toHaveBeenCalled();
    expect(signTransactionMock).not.toHaveBeenCalled();
  });
});
