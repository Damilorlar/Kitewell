import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CI-friendly tests for the path payment builder in `./freighter`.
 *
 * Nothing here touches the network or a Freighter wallet:
 * - `@stellar/freighter-api` is mocked; `signTransaction` echoes the unsigned
 *   XDR so the real SDK can re-parse it.
 * - The Horizon `Server` is mocked for `loadAccount` / `submitTransaction`.
 * - The real `Operation`, `TransactionBuilder`, `Asset`, and `Account` classes
 *   are used, so the built operation is genuine.
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
const { normalizeAmount, pathPaymentWithFreighter } = await import("./freighter");

const SOURCE = StellarSdk.Keypair.random().publicKey();
const DESTINATION = StellarSdk.Keypair.random().publicKey();
const ISSUER = StellarSdk.Keypair.random().publicKey();

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockResolvedValue(new StellarSdk.Account(SOURCE, "1"));
  submitTransactionMock.mockResolvedValue({ hash: "abc123hash", ledger: 7 });
  signTransactionMock.mockImplementation(async (xdr) => ({
    signedTxXdr: xdr,
  }));
});

describe("normalizeAmount", () => {
  it("accepts positive amounts with up to 7 decimals", () => {
    expect(normalizeAmount("10")).toBe("10");
    expect(normalizeAmount("0.0000001")).toBe("0.0000001");
    expect(normalizeAmount("12.3456789")).toBe("12.3456789");
  });

  it("rejects zero, negatives, non-numbers, and over-precision", () => {
    expect(() => normalizeAmount("0")).toThrow(/greater than zero/);
    expect(() => normalizeAmount("0.0000000")).toThrow(/greater than zero/);
    expect(() => normalizeAmount("-5")).toThrow(/positive number/);
    expect(() => normalizeAmount("1e-7")).toThrow(/positive number/);
    expect(() => normalizeAmount("1.12345678")).toThrow(/7 decimals/);
    expect(() => normalizeAmount("")).toThrow(/positive number/);
  });
});

describe("pathPaymentWithFreighter", () => {
  it("builds and submits a strict send path payment", async () => {
    const result = await pathPaymentWithFreighter({
      publicKey: SOURCE,
      destination: DESTINATION,
      mode: "strictSend",
      sendAsset: { isNative: true },
      destAsset: { isNative: false, code: "USDC", issuer: ISSUER },
      amount: "10",
      destMin: "9.5",
      path: "",
    });

    expect(result).toEqual({ hash: "abc123hash", ledger: 7 });
    expect(loadAccountMock).toHaveBeenCalledWith(SOURCE);
    expect(signTransactionMock).toHaveBeenCalledTimes(1);
    expect(submitTransactionMock).toHaveBeenCalledTimes(1);

    const op = submitTransactionMock.mock.calls[0][0].operations[0];
    expect(op.type).toBe("pathPaymentStrictSend");
    expect(op.destination).toBe(DESTINATION);
    expect(op.sendAmount).toBe("10.0000000");
    expect(op.destMin).toBe("9.5000000");
    expect(op.sendAsset.isNative()).toBe(true);
    expect(op.destAsset.getCode()).toBe("USDC");
    expect(op.path).toHaveLength(0);
  });

  it("builds a strict receive op with sendMax and intermediate hops", async () => {
    await pathPaymentWithFreighter({
      publicKey: SOURCE,
      destination: DESTINATION,
      mode: "strictReceive",
      sendAsset: { isNative: true },
      destAsset: { isNative: false, code: "USDC", issuer: ISSUER },
      amount: "25",
      sendMax: "26",
      path: `FOO:${ISSUER}`,
    });

    const op = submitTransactionMock.mock.calls[0][0].operations[0];
    expect(op.type).toBe("pathPaymentStrictReceive");
    expect(op.destAmount).toBe("25.0000000");
    expect(op.sendMax).toBe("26.0000000");
    expect(op.path).toHaveLength(1);
    expect(op.path[0].getCode()).toBe("FOO");
  });

  it("rejects an invalid destination before touching Horizon", async () => {
    await expect(
      pathPaymentWithFreighter({
        publicKey: SOURCE,
        destination: "not-a-key",
        mode: "strictSend",
        sendAsset: { isNative: true },
        destAsset: { isNative: true },
        amount: "1",
        destMin: "1",
      })
    ).rejects.toThrow(/valid Stellar public key/);

    expect(loadAccountMock).not.toHaveBeenCalled();
    expect(submitTransactionMock).not.toHaveBeenCalled();
  });

  it("rejects a missing or invalid bound", async () => {
    await expect(
      pathPaymentWithFreighter({
        publicKey: SOURCE,
        destination: DESTINATION,
        mode: "strictSend",
        sendAsset: { isNative: true },
        destAsset: { isNative: true },
        amount: "1",
      })
    ).rejects.toThrow(/Minimum received/);

    expect(submitTransactionMock).not.toHaveBeenCalled();
  });

  it("rejects an unsupported mode", async () => {
    await expect(
      pathPaymentWithFreighter({
        publicKey: SOURCE,
        destination: DESTINATION,
        mode: "whatever",
        sendAsset: { isNative: true },
        destAsset: { isNative: true },
        amount: "1",
        destMin: "1",
      })
    ).rejects.toThrow(/Unsupported path payment mode/);
  });

  it("surfaces a Freighter signing rejection", async () => {
    signTransactionMock.mockResolvedValueOnce({
      error: { message: "User declined" },
    });

    await expect(
      pathPaymentWithFreighter({
        publicKey: SOURCE,
        destination: DESTINATION,
        mode: "strictSend",
        sendAsset: { isNative: true },
        destAsset: { isNative: true },
        amount: "1",
        destMin: "1",
      })
    ).rejects.toThrow("User declined");

    expect(submitTransactionMock).not.toHaveBeenCalled();
  });
});
