import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CI-friendly tests locking the text memo limit to UTF-8 bytes, not code
 * units. Freighter and Horizon are mocked; the real SDK builds the operation.
 * `é` is two UTF-8 bytes: fourteen are 28 bytes, fifteen are 30.
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

const LONGEST_MULTIBYTE_MEMO = "é".repeat(14);
const TOO_LONG_MULTIBYTE_MEMO = "é".repeat(15);

function memoText(transaction) {
  const value = transaction.memo.value;
  if (typeof value === "string") return value;
  return new TextDecoder().decode(Uint8Array.from(value));
}

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockResolvedValue(new StellarSdk.Account(SOURCE, "1"));
  submitTransactionMock.mockResolvedValue({ hash: "multibytehash", ledger: 3 });
  signTransactionMock.mockImplementation(async (xdr) => ({
    signedTxXdr: xdr,
  }));
});

describe("text memo 28-byte limit with multibyte characters", () => {
  it("submits a text memo of 14 é characters (28 UTF-8 bytes)", async () => {
    expect(new TextEncoder().encode(LONGEST_MULTIBYTE_MEMO).length).toBe(28);

    await sendPaymentWithFreighter(
      SOURCE,
      DESTINATION,
      "10",
      null,
      "text",
      LONGEST_MULTIBYTE_MEMO
    );

    expect(loadAccountMock).toHaveBeenCalledTimes(1);
    expect(submitTransactionMock).toHaveBeenCalledTimes(1);

    const submitted = submitTransactionMock.mock.calls[0][0];
    const op = submitted.operations[0];
    expect(op.type).toBe("payment");
    expect(op.destination).toBe(DESTINATION);
    expect(op.amount).toBe("10.0000000");
    expect(op.asset.isNative()).toBe(true);

    expect(submitted.memo.type).toBe("text");
    expect(memoText(submitted)).toBe(LONGEST_MULTIBYTE_MEMO);
    expect(new TextEncoder().encode(memoText(submitted)).length).toBe(28);

    const roundTripped = StellarSdk.TransactionBuilder.fromXDR(
      submitted.toXDR(),
      StellarSdk.Networks.TESTNET
    );
    expect(roundTripped.memo.type).toBe("text");
    expect(memoText(roundTripped)).toBe(LONGEST_MULTIBYTE_MEMO);
  });

  it("rejects a text memo of 15 é characters (30 UTF-8 bytes) before loading the account", async () => {
    expect(new TextEncoder().encode(TOO_LONG_MULTIBYTE_MEMO).length).toBe(30);

    await expect(
      sendPaymentWithFreighter(
        SOURCE,
        DESTINATION,
        "10",
        null,
        "text",
        TOO_LONG_MULTIBYTE_MEMO
      )
    ).rejects.toThrow("Text memos must be 28 UTF-8 bytes or fewer.");

    expect(loadAccountMock).not.toHaveBeenCalled();
    expect(signTransactionMock).not.toHaveBeenCalled();
    expect(submitTransactionMock).not.toHaveBeenCalled();
  });
});
