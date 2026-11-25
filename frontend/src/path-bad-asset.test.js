import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CI-friendly test for path payment destination-asset validation.
 *
 * Freighter and Horizon are mocked; the real SDK builds the operation.
 * `buildAsset` runs before `loadAccount`, so a malformed `destAsset` must
 * reject without ever reaching Horizon.
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
const ISSUER = StellarSdk.Keypair.random().publicKey();

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockResolvedValue(new StellarSdk.Account(SOURCE, "1"));
  submitTransactionMock.mockResolvedValue({ hash: "payhash", ledger: 3 });
  signTransactionMock.mockImplementation(async (xdr) => ({
    signedTxXdr: xdr,
  }));
});

describe("pathPaymentWithFreighter destination asset", () => {
  it("rejects a credit destAsset with no code before calling loadAccount", async () => {
    await expect(
      pathPaymentWithFreighter({
        publicKey: SOURCE,
        destination: DESTINATION,
        mode: "strictSend",
        sendAsset: { isNative: true },
        destAsset: { isNative: false, issuer: ISSUER },
        amount: "10",
        destMin: "9.5",
      })
    ).rejects.toThrow(/code is required/);

    expect(loadAccountMock).not.toHaveBeenCalled();
    expect(submitTransactionMock).not.toHaveBeenCalled();
  });
});
