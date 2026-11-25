import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CI-friendly tests locking the 64-character hexadecimal hash memo. Freighter
 * and Horizon are mocked; the real SDK builds the operation.
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

const LOWER_HASH = "0123456789abcdef".repeat(4);
const UPPER_HASH = LOWER_HASH.toUpperCase();
const SHORT_HASH = LOWER_HASH.slice(0, 63);

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockResolvedValue(new StellarSdk.Account(SOURCE, "1"));
  submitTransactionMock.mockResolvedValue({ hash: "hashmemohash", ledger: 3 });
  signTransactionMock.mockImplementation(async (xdr) => ({
    signedTxXdr: xdr,
  }));
});

function submittedTransaction() {
  expect(submitTransactionMock).toHaveBeenCalledTimes(1);
  return submitTransactionMock.mock.calls[0][0];
}

/** Hash memos carry a Buffer; normalize it back to lowercase hex. */
function memoHex(transaction) {
  return Buffer.from(transaction.memo.value).toString("hex");
}

describe("hash memo length and hex case", () => {
  it("submits 64 lowercase hex characters as a hash memo", async () => {
    expect(LOWER_HASH).toHaveLength(64);

    await sendPaymentWithFreighter(
      SOURCE,
      DESTINATION,
      "10",
      null,
      "hash",
      LOWER_HASH
    );

    expect(loadAccountMock).toHaveBeenCalledWith(SOURCE);

    const submitted = submittedTransaction();
    expect(submitted.memo.type).toBe("hash");
    expect(memoHex(submitted)).toBe(LOWER_HASH);

    const op = submitted.operations[0];
    expect(op.type).toBe("payment");
    expect(op.destination).toBe(DESTINATION);
    expect(op.amount).toBe("10.0000000");

    const roundTripped = StellarSdk.TransactionBuilder.fromXDR(
      submitted.toXDR(),
      StellarSdk.Networks.TESTNET
    );
    expect(roundTripped.memo.type).toBe("hash");
    expect(memoHex(roundTripped)).toBe(LOWER_HASH);
  });

  it("submits 64 uppercase hex characters as a hash memo", async () => {
    expect(UPPER_HASH).toHaveLength(64);

    await sendPaymentWithFreighter(
      SOURCE,
      DESTINATION,
      "10",
      null,
      "hash",
      UPPER_HASH
    );

    expect(loadAccountMock).toHaveBeenCalledWith(SOURCE);

    const submitted = submittedTransaction();
    expect(submitted.memo.type).toBe("hash");
    expect(memoHex(submitted)).toBe(LOWER_HASH);

    const roundTripped = StellarSdk.TransactionBuilder.fromXDR(
      submitted.toXDR(),
      StellarSdk.Networks.TESTNET
    );
    expect(roundTripped.memo.type).toBe("hash");
    expect(memoHex(roundTripped)).toBe(LOWER_HASH);
  });

  it("rejects a 63-character hash before loading the account", async () => {
    expect(SHORT_HASH).toHaveLength(63);

    await expect(
      sendPaymentWithFreighter(SOURCE, DESTINATION, "10", null, "hash", SHORT_HASH)
    ).rejects.toThrow("Hash memos must be exactly 64 hexadecimal characters.");

    expect(loadAccountMock).not.toHaveBeenCalled();
    expect(signTransactionMock).not.toHaveBeenCalled();
    expect(submitTransactionMock).not.toHaveBeenCalled();
  });
});
