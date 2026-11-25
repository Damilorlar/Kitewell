import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CI-friendly tests for the unsigned envelope preview added to `./freighter`.
 *
 * The composer must be able to show/copy the base64 XDR before Freighter opens,
 * and signing must use that exact envelope. Freighter and Horizon are mocked;
 * the real SDK builds and decodes the transactions.
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
  buildPaymentEnvelope,
  buildUnsignedEnvelope,
  submitEnvelopeWithFreighter,
  sendPaymentWithFreighter,
} = await import("./freighter");

const SOURCE = StellarSdk.Keypair.random().publicKey();
const DESTINATION = StellarSdk.Keypair.random().publicKey();

function decode(xdr) {
  return StellarSdk.TransactionBuilder.fromXDR(
    xdr,
    StellarSdk.Networks.TESTNET
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Fresh account per call: the SDK increments the sequence on build.
  loadAccountMock.mockImplementation(
    async () => new StellarSdk.Account(SOURCE, "1")
  );
  submitTransactionMock.mockResolvedValue({ hash: "envelopeHash", ledger: 5 });
  signTransactionMock.mockImplementation(async (xdr) => ({
    signedTxXdr: xdr,
  }));
});

describe("buildPaymentEnvelope", () => {
  it("returns base64 XDR that decodes to the payment operations", async () => {
    const xdr = await buildPaymentEnvelope(SOURCE, DESTINATION, "10");

    // Base64, not a hex dump.
    expect(xdr).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(btoa(atob(xdr))).toBe(xdr);

    const tx = decode(xdr);
    expect(tx.source).toBe(SOURCE);
    expect(tx.operations).toHaveLength(1);
    expect(tx.operations[0].type).toBe("payment");
    expect(tx.operations[0].destination).toBe(DESTINATION);
    expect(tx.operations[0].amount).toBe("10.0000000");
    expect(tx.operations[0].asset.isNative()).toBe(true);
  });

  it("keeps the memo in the unsigned envelope", async () => {
    const xdr = await buildPaymentEnvelope(
      SOURCE,
      DESTINATION,
      "3",
      { isNative: true },
      "text",
      "invoice-42"
    );

    const tx = decode(xdr);
    expect(tx.memo.type).toBe("text");
    expect(tx.memo.value.toString()).toBe("invoice-42");
  });

  it("neither signs nor submits", async () => {
    await buildPaymentEnvelope(SOURCE, DESTINATION, "10");

    expect(signTransactionMock).not.toHaveBeenCalled();
    expect(submitTransactionMock).not.toHaveBeenCalled();
  });
});

describe("buildUnsignedEnvelope", () => {
  it("has nothing to build or copy for an empty operation list", async () => {
    await expect(buildUnsignedEnvelope(SOURCE, [])).rejects.toThrow(
      "Add at least one operation before building an envelope."
    );
    expect(loadAccountMock).not.toHaveBeenCalled();
    expect(signTransactionMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid source account before loading it", async () => {
    await expect(buildUnsignedEnvelope("NOT_A_KEY", [])).rejects.toThrow(
      "Connect a valid Freighter address first."
    );
  });
});

describe("submitEnvelopeWithFreighter", () => {
  it("signs the exact XDR string that was previewed/copied", async () => {
    const xdr = await buildPaymentEnvelope(SOURCE, DESTINATION, "10");

    const result = await submitEnvelopeWithFreighter(xdr, SOURCE);

    expect(result).toEqual({ hash: "envelopeHash", ledger: 5 });
    expect(signTransactionMock).toHaveBeenCalledTimes(1);
    expect(signTransactionMock.mock.calls[0][0]).toBe(xdr);

    const submitted = submitTransactionMock.mock.calls[0][0];
    expect(submitted.operations[0].type).toBe("payment");
    expect(submitted.operations[0].amount).toBe("10.0000000");
  });

  it("rejects an empty envelope without touching Freighter", async () => {
    await expect(submitEnvelopeWithFreighter("", SOURCE)).rejects.toThrow(
      "No unsigned envelope to sign."
    );
    expect(signTransactionMock).not.toHaveBeenCalled();
    expect(submitTransactionMock).not.toHaveBeenCalled();
  });
});

describe("sendPaymentWithFreighter", () => {
  it("signs the same envelope the composer would display", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

      const previewed = await buildPaymentEnvelope(SOURCE, DESTINATION, "10");
      await sendPaymentWithFreighter(SOURCE, DESTINATION, "10");

      expect(signTransactionMock).toHaveBeenCalledTimes(1);
      expect(signTransactionMock.mock.calls[0][0]).toBe(previewed);
      expect(submitTransactionMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
