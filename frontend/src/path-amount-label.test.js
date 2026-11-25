import { beforeEach, describe, expect, it, vi } from "vitest";

const { submitTransactionMock } = vi.hoisted(() => ({ submitTransactionMock: vi.fn() }));

vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(),
  setAllowed: vi.fn(),
  getAddress: vi.fn(),
  getNetwork: vi.fn(async () => {
    const { getActiveNetwork } = await import("./network");
    const active = getActiveNetwork();
    return { network: active.id, networkPassphrase: active.passphrase };
  }),
  signTransaction: vi.fn(),
}));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: vi.fn(function () {
        return { loadAccount: vi.fn(), submitTransaction: submitTransactionMock };
      }),
    },
  };
});

const StellarSdk = await import("@stellar/stellar-sdk");
const { pathPaymentWithFreighter } = await import("./freighter");
const SOURCE = StellarSdk.Keypair.random().publicKey();
const DESTINATION = StellarSdk.Keypair.random().publicKey();

beforeEach(() => vi.clearAllMocks());

describe("path payment amount labels", () => {
  it("labels the strict-send amount", async () => {
    await expect(
      pathPaymentWithFreighter({
        publicKey: SOURCE,
        destination: DESTINATION,
        mode: "strictSend",
        sendAsset: { isNative: true },
        destAsset: { isNative: true },
        amount: "0",
        destMin: "1",
      })
    ).rejects.toThrow(/Amount to send/);
    expect(submitTransactionMock).not.toHaveBeenCalled();
  });

  it("labels the strict-receive amount", async () => {
    await expect(
      pathPaymentWithFreighter({
        publicKey: SOURCE,
        destination: DESTINATION,
        mode: "strictReceive",
        sendAsset: { isNative: true },
        destAsset: { isNative: true },
        amount: "0",
        sendMax: "1",
      })
    ).rejects.toThrow(/Amount to receive/);
    expect(submitTransactionMock).not.toHaveBeenCalled();
  });
});
