import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CI-friendly tests for sending a payment to an M… muxed account.
 * Freighter and Horizon are mocked; the real SDK builds the operation.
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
const { buildMuxedAddress, splitMuxedAddress } = await import(
  "./addressFormat"
);
const { sendPaymentWithFreighter } = await import("./freighter");

const SOURCE = StellarSdk.Keypair.random().publicKey();
const BASE_DESTINATION = StellarSdk.Keypair.random().publicKey();

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockResolvedValue(new StellarSdk.Account(SOURCE, "1"));
  submitTransactionMock.mockResolvedValue({ hash: "muxedhash", ledger: 5 });
  signTransactionMock.mockImplementation(async (xdr) => ({ signedTxXdr: xdr }));
});

describe("sendPaymentWithFreighter muxed destination", () => {
  it("submits the operation to the M address", async () => {
    const muxed = buildMuxedAddress(BASE_DESTINATION, "18446744073709551615");

    await sendPaymentWithFreighter(SOURCE, muxed, "1");

    expect(signTransactionMock).toHaveBeenCalledTimes(1);
    const operation = submitTransactionMock.mock.calls[0][0].operations[0];
    expect(operation.type).toBe("payment");
    expect(operation.destination).toBe(muxed);
    expect(splitMuxedAddress(operation.destination).gAddress).toBe(
      BASE_DESTINATION
    );
  });

  it("still accepts a plain G destination", async () => {
    await sendPaymentWithFreighter(SOURCE, BASE_DESTINATION, "1");

    const operation = submitTransactionMock.mock.calls[0][0].operations[0];
    expect(operation.destination).toBe(BASE_DESTINATION);
  });

  it("refuses a malformed muxed address before signing", async () => {
    await expect(
      sendPaymentWithFreighter(SOURCE, "Mnot-a-muxed-address", "1")
    ).rejects.toThrow(/valid Stellar public key .*muxed address/i);

    expect(signTransactionMock).not.toHaveBeenCalled();
    expect(submitTransactionMock).not.toHaveBeenCalled();
  });
});
