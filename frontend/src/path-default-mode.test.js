import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Issue #132: lock the `pathPaymentWithFreighter` default mode.
 *
 * `path-payment.test.js` always passes an explicit `mode`, so nothing stops a
 * later edit from flipping the `mode = "strictSend"` default in `./freighter`
 * to `"strictReceive"` (or dropping it) without a test failing. This suite
 * omits `mode` entirely and pins the resulting operation.
 *
 * Nothing here touches the network or a Freighter wallet:
 * - `@stellar/freighter-api` is mocked; `signTransaction` echoes the unsigned
 *   XDR so the real SDK can re-parse it.
 * - The Horizon `Server` is mocked for `loadAccount` / `submitTransaction`.
 * - The real `Operation`, `TransactionBuilder`, `Asset`, and `Account` classes
 *   build the operation, so the asserted shape is a genuine XDR round-trip.
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
const { pathPaymentWithFreighter } = await import("./freighter");

const SOURCE = StellarSdk.Keypair.random().publicKey();
const DESTINATION = StellarSdk.Keypair.random().publicKey();

/** Native XLM on both legs, the default-mode path with no intermediate hops. */
const NATIVE_LEGS = {
  publicKey: SOURCE,
  destination: DESTINATION,
  sendAsset: { isNative: true },
  destAsset: { isNative: true },
};

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockResolvedValue(new StellarSdk.Account(SOURCE, "1"));
  submitTransactionMock.mockResolvedValue({ hash: "defaulthash", ledger: 9 });
  signTransactionMock.mockImplementation(async (xdr) => ({
    signedTxXdr: xdr,
  }));
});

/** The single operation handed to Horizon for the current call. */
function submittedOperation() {
  expect(submitTransactionMock).toHaveBeenCalledTimes(1);
  return submitTransactionMock.mock.calls[0][0].operations[0];
}

describe("pathPaymentWithFreighter default mode", () => {
  it("submits pathPaymentStrictSend when mode is omitted", async () => {
    const result = await pathPaymentWithFreighter({
      ...NATIVE_LEGS,
      amount: "1",
      destMin: "1",
    });

    expect(result).toEqual({ hash: "defaulthash", ledger: 9 });

    const op = submittedOperation();
    expect(op.type).toBe("pathPaymentStrictSend");
    expect(op.destination).toBe(DESTINATION);
    expect(op.sendAmount).toBe("1.0000000");
    expect(op.destMin).toBe("1.0000000");
    expect(op.sendAsset.isNative()).toBe(true);
    expect(op.destAsset.isNative()).toBe(true);
    expect(op.path).toHaveLength(0);
  });

  it("never builds a strict receive op by default", async () => {
    await pathPaymentWithFreighter({
      ...NATIVE_LEGS,
      amount: "1",
      destMin: "1",
    });

    const op = submittedOperation();
    expect(op.destAmount).toBeUndefined();
    expect(op.sendMax).toBeUndefined();
  });

  it("reads the default bound from destMin, not sendMax", async () => {
    // Strict send validates `destMin`; a flipped default would validate
    // `sendMax` instead, so this call only resolves under strict send.
    const result = await pathPaymentWithFreighter({
      ...NATIVE_LEGS,
      amount: "1",
      destMin: "0.5",
      sendMax: "99",
    });

    expect(result.hash).toBe("defaulthash");
    expect(submittedOperation().destMin).toBe("0.5000000");
  });

  it("requires destMin by default and never reads sendMax", async () => {
    await expect(
      pathPaymentWithFreighter({
        ...NATIVE_LEGS,
        amount: "1",
        sendMax: "2",
      })
    ).rejects.toThrow(/Minimum received/);

    expect(loadAccountMock).not.toHaveBeenCalled();
    expect(submitTransactionMock).not.toHaveBeenCalled();
  });

  it("treats an explicit undefined mode the same as omitting it", async () => {
    await pathPaymentWithFreighter({
      ...NATIVE_LEGS,
      mode: undefined,
      amount: "1",
      destMin: "1",
    });

    expect(submittedOperation().type).toBe("pathPaymentStrictSend");
  });

  it("builds the same operation as an explicit strictSend", async () => {
    await pathPaymentWithFreighter({
      ...NATIVE_LEGS,
      amount: "1",
      destMin: "1",
    });
    const defaulted = submittedOperation();

    submitTransactionMock.mockClear();
    await pathPaymentWithFreighter({
      ...NATIVE_LEGS,
      mode: "strictSend",
      amount: "1",
      destMin: "1",
    });
    const explicit = submittedOperation();

    expect(defaulted.type).toBe(explicit.type);
    expect(defaulted.sendAmount).toBe(explicit.sendAmount);
    expect(defaulted.destMin).toBe(explicit.destMin);
    expect(defaulted.destination).toBe(explicit.destination);
  });

  it("still honours an explicit strictReceive", async () => {
    await pathPaymentWithFreighter({
      ...NATIVE_LEGS,
      mode: "strictReceive",
      amount: "1",
      sendMax: "1",
    });

    const op = submittedOperation();
    expect(op.type).toBe("pathPaymentStrictReceive");
    expect(op.destAmount).toBe("1.0000000");
    expect(op.sendMax).toBe("1.0000000");
  });
});
