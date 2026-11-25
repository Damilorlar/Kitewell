import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CI-friendly tests for the multi-operation composer helpers.
 * Freighter and Horizon are mocked; the real SDK builds the operations.
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
const {
  MAX_COMPOSED_OPERATIONS,
  buildComposedOperation,
  buildComposedTransaction,
  getFailedOperationIndex,
  submitComposedOperations,
} = await import("./freighter");
const { setActiveNetwork } = await import("./network");

const SOURCE = StellarSdk.Keypair.random().publicKey();
const DESTINATION = StellarSdk.Keypair.random().publicKey();
const ISSUER = StellarSdk.Keypair.random().publicKey();

const paymentEntry = {
  type: "payment",
  destination: DESTINATION,
  amount: "10",
  asset: { isNative: true },
};

const trustEntry = {
  type: "changeTrust",
  code: "usdc",
  issuer: ISSUER,
  limit: "1000",
};

const dataEntry = {
  type: "manageData",
  name: "invoice",
  value: "42",
};

beforeEach(() => {
  setActiveNetwork("TESTNET");
  vi.clearAllMocks();
  loadAccountMock.mockResolvedValue(new StellarSdk.Account(SOURCE, "1"));
  submitTransactionMock.mockResolvedValue({ hash: "composedhash", ledger: 12 });
  signTransactionMock.mockImplementation(async (xdr) => ({ signedTxXdr: xdr }));
});

afterEach(() => {
  setActiveNetwork("TESTNET");
});

describe("buildComposedTransaction", () => {
  it("builds a two-operation transaction in the order the user added", () => {
    const transaction = buildComposedTransaction(
      new StellarSdk.Account(SOURCE, "1"),
      [paymentEntry, trustEntry]
    );

    expect(transaction.operations).toHaveLength(2);
    expect(transaction.operations.map((op) => op.type)).toEqual([
      "payment",
      "changeTrust",
    ]);

    const [payment, trust] = transaction.operations;
    expect(payment.destination).toBe(DESTINATION);
    expect(payment.amount).toBe("10.0000000");
    expect(payment.asset.isNative()).toBe(true);
    expect(trust.line.getCode()).toBe("USDC");
    expect(trust.line.getIssuer()).toBe(ISSUER);
    expect(trust.limit).toBe("1000.0000000");
  });

  it("keeps the caller's ordering, including a later payment", () => {
    const transaction = buildComposedTransaction(
      new StellarSdk.Account(SOURCE, "1"),
      [trustEntry, dataEntry, paymentEntry]
    );

    expect(transaction.operations.map((op) => op.type)).toEqual([
      "changeTrust",
      "manageData",
      "payment",
    ]);
  });

  it("builds a manageData operation from a composer row", () => {
    const transaction = buildComposedTransaction(
      new StellarSdk.Account(SOURCE, "1"),
      [dataEntry]
    );

    const operation = transaction.operations[0];
    expect(operation.type).toBe("manageData");
    expect(operation.name).toBe("invoice");
    expect(operation.value.toString()).toBe("42");
  });

  it("rejects an invalid row before building", () => {
    expect(() =>
      buildComposedOperation({ ...paymentEntry, destination: "not-a-key" })
    ).toThrow(/valid Stellar public key/);
    expect(() =>
      buildComposedOperation({ ...dataEntry, value: "x".repeat(65) })
    ).toThrow(/64 UTF-8 bytes/);
  });
});

describe("submitComposedOperations", () => {
  it("signs once and submits the whole ordered list as one transaction", async () => {
    const result = await submitComposedOperations(SOURCE, [
      paymentEntry,
      trustEntry,
      dataEntry,
    ]);

    expect(result.hash).toBe("composedhash");
    expect(signTransactionMock).toHaveBeenCalledTimes(1);
    expect(submitTransactionMock).toHaveBeenCalledTimes(1);

    const submitted = submitTransactionMock.mock.calls[0][0];
    expect(submitted.operations.map((op) => op.type)).toEqual([
      "payment",
      "changeTrust",
      "manageData",
    ]);
  });

  it("does not open Freighter for an empty list", async () => {
    await expect(submitComposedOperations(SOURCE, [])).rejects.toThrow(
      /at least one operation/i
    );

    expect(loadAccountMock).not.toHaveBeenCalled();
    expect(signTransactionMock).not.toHaveBeenCalled();
    expect(submitTransactionMock).not.toHaveBeenCalled();
  });

  it("refuses more than 100 operations before opening Freighter", async () => {
    const entries = Array.from(
      { length: MAX_COMPOSED_OPERATIONS + 1 },
      () => paymentEntry
    );

    await expect(submitComposedOperations(SOURCE, entries)).rejects.toThrow(
      /at most 100 operations/
    );

    expect(loadAccountMock).not.toHaveBeenCalled();
    expect(signTransactionMock).not.toHaveBeenCalled();
    expect(submitTransactionMock).not.toHaveBeenCalled();
  });

  it("accepts exactly 100 operations", async () => {
    const entries = Array.from(
      { length: MAX_COMPOSED_OPERATIONS },
      () => paymentEntry
    );

    await submitComposedOperations(SOURCE, entries);

    expect(submitTransactionMock.mock.calls[0][0].operations).toHaveLength(100);
    expect(signTransactionMock).toHaveBeenCalledTimes(1);
  });

  it("reports the operation index Horizon names on failure", async () => {
    const horizonError = new Error("Transaction Failed");
    horizonError.response = {
      status: 400,
      data: {
        type: "https://stellar.org/horizon-errors/transaction_failed",
        status: 400,
        extras: {
          result_codes: {
            transaction: "tx_failed",
            operations: ["op_success", "op_underfunded"],
          },
        },
      },
    };
    submitTransactionMock.mockRejectedValue(horizonError);

    expect(getFailedOperationIndex(horizonError)).toBe(1);

    await expect(
      submitComposedOperations(SOURCE, [paymentEntry, paymentEntry])
    ).rejects.toMatchObject({
      message: expect.stringContaining("Operation index 1 failed"),
      operationIndex: 1,
    });
  });

  it("propagates a submit error that has no operation index", async () => {
    const submitError = new Error("Horizon submit failed");
    submitTransactionMock.mockRejectedValue(submitError);

    await expect(
      submitComposedOperations(SOURCE, [paymentEntry])
    ).rejects.toBe(submitError);
  });
});
