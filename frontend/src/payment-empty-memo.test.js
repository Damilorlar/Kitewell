import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CI-friendly tests locking an empty memo off the payment.
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
const { sendPaymentWithFreighter } = await import("./freighter");

const SOURCE = StellarSdk.Keypair.random().publicKey();
const DESTINATION = StellarSdk.Keypair.random().publicKey();

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockResolvedValue(new StellarSdk.Account(SOURCE, "1"));
  submitTransactionMock.mockResolvedValue({ hash: "emptymemohash", ledger: 3 });
  signTransactionMock.mockImplementation(async (xdr) => ({
    signedTxXdr: xdr,
  }));
});

function submittedTransaction() {
  expect(submitTransactionMock).toHaveBeenCalledTimes(1);
  return submitTransactionMock.mock.calls[0][0];
}

describe("empty memo stays off the payment", () => {
  it("submits an empty text memo with memo type none", async () => {
    await sendPaymentWithFreighter(SOURCE, DESTINATION, "10", null, "text", "");

    const submitted = submittedTransaction();
    expect(submitted.memo.type).toBe("none");

    const op = submitted.operations[0];
    expect(op.type).toBe("payment");
    expect(op.destination).toBe(DESTINATION);
    expect(op.amount).toBe("10.0000000");

    const roundTripped = StellarSdk.TransactionBuilder.fromXDR(
      submitted.toXDR(),
      StellarSdk.Networks.TESTNET
    );
    expect(roundTripped.memo.type).toBe("none");
  });

  it("submits an empty id memo with memo type none", async () => {
    await sendPaymentWithFreighter(SOURCE, DESTINATION, "10", null, "id", "");

    const submitted = submittedTransaction();
    expect(submitted.memo.type).toBe("none");

    const op = submitted.operations[0];
    expect(op.type).toBe("payment");
    expect(op.destination).toBe(DESTINATION);
    expect(op.amount).toBe("10.0000000");

    const roundTripped = StellarSdk.TransactionBuilder.fromXDR(
      submitted.toXDR(),
      StellarSdk.Networks.TESTNET
    );
    expect(roundTripped.memo.type).toBe("none");
  });

  it("submits an empty hash memo with memo type none", async () => {
    await sendPaymentWithFreighter(SOURCE, DESTINATION, "10", null, "hash", "");

    const submitted = submittedTransaction();
    expect(submitted.memo.type).toBe("none");

    const op = submitted.operations[0];
    expect(op.type).toBe("payment");
    expect(op.destination).toBe(DESTINATION);
    expect(op.amount).toBe("10.0000000");

    const roundTripped = StellarSdk.TransactionBuilder.fromXDR(
      submitted.toXDR(),
      StellarSdk.Networks.TESTNET
    );
    expect(roundTripped.memo.type).toBe("none");
  });

  it("keeps a non-empty memo on the payment", async () => {
    await sendPaymentWithFreighter(
      SOURCE,
      DESTINATION,
      "10",
      null,
      "text",
      "rent"
    );

    const submitted = submittedTransaction();
    expect(submitted.memo.type).toBe("text");
    expect(submitted.operations[0].type).toBe("payment");
  });
});
