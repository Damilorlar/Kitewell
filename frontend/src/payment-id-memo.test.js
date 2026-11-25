import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CI-friendly tests locking accepted id memos, including zero and the uint64
 * maximum. Freighter and Horizon are mocked; the real SDK builds the
 * operation.
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

const MAX_UINT64 = "18446744073709551615";

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockResolvedValue(new StellarSdk.Account(SOURCE, "1"));
  submitTransactionMock.mockResolvedValue({ hash: "idmemohash", ledger: 3 });
  signTransactionMock.mockImplementation(async (xdr) => ({
    signedTxXdr: xdr,
  }));
});

function submittedTransaction() {
  expect(submitTransactionMock).toHaveBeenCalledTimes(1);
  return submitTransactionMock.mock.calls[0][0];
}

describe("id memo accepts uint64 values", () => {
  it("submits memo 0 as an id memo", async () => {
    await sendPaymentWithFreighter(SOURCE, DESTINATION, "10", null, "id", "0");

    expect(loadAccountMock).toHaveBeenCalledWith(SOURCE);

    const submitted = submittedTransaction();
    expect(submitted.memo.type).toBe("id");
    expect(submitted.memo.value).toBe("0");

    const op = submitted.operations[0];
    expect(op.type).toBe("payment");
    expect(op.destination).toBe(DESTINATION);
    expect(op.amount).toBe("10.0000000");

    const roundTripped = StellarSdk.TransactionBuilder.fromXDR(
      submitted.toXDR(),
      StellarSdk.Networks.TESTNET
    );
    expect(roundTripped.memo.type).toBe("id");
    expect(roundTripped.memo.value).toBe("0");
  });

  it("submits the uint64 maximum as an id memo", async () => {
    await sendPaymentWithFreighter(
      SOURCE,
      DESTINATION,
      "10",
      null,
      "id",
      MAX_UINT64
    );

    expect(loadAccountMock).toHaveBeenCalledWith(SOURCE);

    const submitted = submittedTransaction();
    expect(submitted.memo.type).toBe("id");
    expect(submitted.memo.value).toBe(MAX_UINT64);

    const op = submitted.operations[0];
    expect(op.type).toBe("payment");
    expect(op.destination).toBe(DESTINATION);
    expect(op.amount).toBe("10.0000000");

    const roundTripped = StellarSdk.TransactionBuilder.fromXDR(
      submitted.toXDR(),
      StellarSdk.Networks.TESTNET
    );
    expect(roundTripped.memo.type).toBe("id");
    expect(roundTripped.memo.value).toBe(MAX_UINT64);
  });
});
