import { beforeEach, describe, expect, it, vi } from "vitest";

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
  getNetwork: vi.fn().mockResolvedValue({
    network: "TESTNET",
    networkPassphrase: "Test SDF Network ; September 2015",
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
const { createAccountWithFreighter } = await import("./freighter");

const SOURCE = StellarSdk.Keypair.random().publicKey();
const DESTINATION = StellarSdk.Keypair.random().publicKey();

beforeEach(() => {
  vi.clearAllMocks();
  submitTransactionMock.mockResolvedValue({
    hash: "createaccounthash",
    ledger: 12,
  });
  signTransactionMock.mockImplementation(async (xdr) => ({ signedTxXdr: xdr }));
});

describe("createAccountWithFreighter", () => {
  it("locks the createAccount operation fields", async () => {
    loadAccountMock
      .mockRejectedValueOnce({ response: { status: 404 } })
      .mockResolvedValueOnce(new StellarSdk.Account(SOURCE, "7"));

    await createAccountWithFreighter(SOURCE, DESTINATION, "2.5");

    expect(submitTransactionMock).toHaveBeenCalledTimes(1);
    const transaction = submitTransactionMock.mock.calls[0][0];
    expect(transaction.operations).toHaveLength(1);
    expect(transaction.operations[0].type).toBe("createAccount");
    expect(transaction.operations[0].destination).toBe(DESTINATION);
    expect(transaction.operations[0].startingBalance).toBe("2.5000000");
  });

  it("rejects starting balances below 1 XLM before account or signing calls", async () => {
    await expect(
      createAccountWithFreighter(SOURCE, DESTINATION, "0.9999999")
    ).rejects.toThrow("at least 1 XLM");

    expect(loadAccountMock).not.toHaveBeenCalled();
    expect(signTransactionMock).not.toHaveBeenCalled();
    expect(submitTransactionMock).not.toHaveBeenCalled();
  });

  it("refuses an existing destination and does not submit", async () => {
    loadAccountMock.mockResolvedValueOnce(
      new StellarSdk.Account(DESTINATION, "1")
    );

    await expect(
      createAccountWithFreighter(SOURCE, DESTINATION, "1")
    ).rejects.toThrow("Destination account already exists");

    expect(loadAccountMock).toHaveBeenCalledTimes(1);
    expect(signTransactionMock).not.toHaveBeenCalled();
    expect(submitTransactionMock).not.toHaveBeenCalled();
  });
});
