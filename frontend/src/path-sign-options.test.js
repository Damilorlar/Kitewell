import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Lock the passphrase passed to Freighter when signing a path payment.
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
const { pathPaymentWithFreighter } = await import("./freighter");
const { setActiveNetwork } = await import("./network");

const SOURCE = StellarSdk.Keypair.random().publicKey();
const DESTINATION = StellarSdk.Keypair.random().publicKey();

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockResolvedValue(new StellarSdk.Account(SOURCE, "1"));
  submitTransactionMock.mockResolvedValue({ hash: "pathhash", ledger: 4 });
  signTransactionMock.mockImplementation(async (xdr) => ({
    signedTxXdr: xdr,
  }));
});

afterEach(() => {
  setActiveNetwork("TESTNET");
});

function signOptions() {
  expect(signTransactionMock).toHaveBeenCalled();
  return signTransactionMock.mock.calls[0][1];
}

async function sendPath() {
  await pathPaymentWithFreighter({
    publicKey: SOURCE,
    destination: DESTINATION,
    sendAsset: { isNative: true },
    destAsset: { isNative: true },
    amount: "1",
    destMin: "1",
  });
}

describe("path payment sign options", () => {
  it("signs on Testnet with the Testnet passphrase and the source address", async () => {
    await sendPath();

    expect(signOptions()).toEqual({
      networkPassphrase: StellarSdk.Networks.TESTNET,
      address: SOURCE,
    });
  });

  it("uses the Futurenet passphrase after setActiveNetwork", async () => {
    setActiveNetwork("FUTURENET");

    await sendPath();

    expect(signOptions().networkPassphrase).toBe(StellarSdk.Networks.FUTURENET);
    expect(signOptions().address).toBe(SOURCE);
  });
});
