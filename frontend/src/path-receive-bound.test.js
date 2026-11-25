import { beforeEach, expect, it, vi } from "vitest";

const { loadAccountMock, submitTransactionMock } = vi.hoisted(() => ({
  loadAccountMock: vi.fn(),
  submitTransactionMock: vi.fn(),
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
  signTransaction: vi.fn(),
}));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: vi.fn(function () {
        return { loadAccount: loadAccountMock, submitTransaction: submitTransactionMock };
      }),
    },
  };
});

const StellarSdk = await import("@stellar/stellar-sdk");
const { pathPaymentWithFreighter } = await import("./freighter");

beforeEach(() => vi.clearAllMocks());

it("requires a maximum to send for strict receive", async () => {
  await expect(
    pathPaymentWithFreighter({
      publicKey: StellarSdk.Keypair.random().publicKey(),
      destination: StellarSdk.Keypair.random().publicKey(),
      mode: "strictReceive",
      sendAsset: { isNative: true },
      destAsset: { isNative: true },
      amount: "1",
    })
  ).rejects.toThrow(/Maximum to send/);

  expect(loadAccountMock).not.toHaveBeenCalled();
});
