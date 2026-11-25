import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CI-friendly tests for `sendPaymentWithFreighter` asset selection.
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
const { resolvePaymentAsset, sendPaymentWithFreighter } = await import(
  "./freighter"
);

const SOURCE = StellarSdk.Keypair.random().publicKey();
const DESTINATION = StellarSdk.Keypair.random().publicKey();
const ISSUER = StellarSdk.Keypair.random().publicKey();

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockResolvedValue(new StellarSdk.Account(SOURCE, "1"));
  submitTransactionMock.mockResolvedValue({ hash: "payhash", ledger: 3 });
  signTransactionMock.mockImplementation(async (xdr) => ({
    signedTxXdr: xdr,
  }));
});

describe("resolvePaymentAsset", () => {
  it("defaults to native XLM", () => {
    expect(resolvePaymentAsset().isNative()).toBe(true);
    expect(resolvePaymentAsset({ isNative: true }).isNative()).toBe(true);
  });

  it("builds a credit asset and upper-cases the code", () => {
    const asset = resolvePaymentAsset({ isNative: false, code: "usdc", issuer: ISSUER });
    expect(asset.getCode()).toBe("USDC");
    expect(asset.getIssuer()).toBe(ISSUER);
  });

  it("rejects bad asset codes and issuers", () => {
    expect(() => resolvePaymentAsset({ code: "TOOLONGCODE12" })).toThrow(
      /1–12 characters/
    );
    expect(() => resolvePaymentAsset({ code: "USDC", issuer: "nope" })).toThrow(
      /valid Stellar public key/
    );
  });
});

describe("sendPaymentWithFreighter", () => {
  it("sends native XLM by default", async () => {
    await sendPaymentWithFreighter(SOURCE, DESTINATION, "10", null, "text", "");

    const op = submitTransactionMock.mock.calls[0][0].operations[0];
    expect(op.type).toBe("payment");
    expect(op.destination).toBe(DESTINATION);
    expect(op.amount).toBe("10.0000000");
    expect(op.asset.isNative()).toBe(true);
  });

  it("uses the selected credit asset in the payment op", async () => {
    await sendPaymentWithFreighter(SOURCE, DESTINATION, "25", {
      isNative: false,
      code: "USDC",
      issuer: ISSUER,
    });

    const op = submitTransactionMock.mock.calls[0][0].operations[0];
    expect(op.type).toBe("payment");
    expect(op.asset.isNative()).toBe(false);
    expect(op.asset.getCode()).toBe("USDC");
    expect(op.asset.getIssuer()).toBe(ISSUER);
    expect(op.amount).toBe("25.0000000");
  });

  it("rejects an invalid credit asset issuer before submitting", async () => {
    await expect(
      sendPaymentWithFreighter(SOURCE, DESTINATION, "5", {
        isNative: false,
        code: "USDC",
        issuer: "not-a-key",
      })
    ).rejects.toThrow(/valid Stellar public key/);

    expect(submitTransactionMock).not.toHaveBeenCalled();
  });
});
