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

const LONGEST_TEXT_MEMO = "a".repeat(28);

function memoText(transaction) {
  const value = transaction.memo.value;
  if (typeof value === "string") return value;
  return new TextDecoder().decode(Uint8Array.from(value));
}

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockResolvedValue(new StellarSdk.Account(SOURCE, "1"));
  submitTransactionMock.mockResolvedValue({ hash: "memo28hash", ledger: 3 });
  signTransactionMock.mockImplementation(async (xdr) => ({
    signedTxXdr: xdr,
  }));
});

describe("text memo 28-byte limit", () => {
  it("submits a text memo of 28 a characters unchanged", async () => {
    await sendPaymentWithFreighter(
      SOURCE,
      DESTINATION,
      "10",
      null,
      "text",
      LONGEST_TEXT_MEMO
    );

    expect(submitTransactionMock).toHaveBeenCalledTimes(1);
    const submitted = submitTransactionMock.mock.calls[0][0];
    expect(submitted.memo.type).toBe("text");
    expect(memoText(submitted)).toBe(LONGEST_TEXT_MEMO);
    expect(new TextEncoder().encode(memoText(submitted)).length).toBe(28);

    const roundTripped = StellarSdk.TransactionBuilder.fromXDR(
      submitted.toXDR(),
      StellarSdk.Networks.TESTNET
    );
    expect(roundTripped.memo.type).toBe("text");
    expect(memoText(roundTripped)).toBe(LONGEST_TEXT_MEMO);
  });

  it("rejects a 29-character text memo before signing", async () => {
    await expect(
      sendPaymentWithFreighter(
        SOURCE,
        DESTINATION,
        "10",
        null,
        "text",
        "a".repeat(29)
      )
    ).rejects.toThrow(/28 UTF-8 bytes/);

    expect(signTransactionMock).not.toHaveBeenCalled();
    expect(submitTransactionMock).not.toHaveBeenCalled();
  });
});
