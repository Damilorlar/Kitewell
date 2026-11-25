import { beforeEach, describe, expect, it, vi } from "vitest";

/** Freighter and Horizon are mocked; the real SDK builds the operation. */
const {
  loadAccountMock,
  submitTransactionMock,
  signTransactionMock,
  ledgerCallMock,
} = vi.hoisted(() => ({
    loadAccountMock: vi.fn(),
    submitTransactionMock: vi.fn(),
    signTransactionMock: vi.fn(),
    ledgerCallMock: vi.fn(),
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
          ledgers: () => ({
            order: () => ({ limit: () => ({ call: ledgerCallMock }) }),
          }),
        };
      }),
    },
  };
});

const StellarSdk = await import("@stellar/stellar-sdk");
const { changeTrustWithFreighter } = await import("./freighter");

const SOURCE = StellarSdk.Keypair.random().publicKey();
const ISSUER = StellarSdk.Keypair.random().publicKey();

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockResolvedValue(
    Object.assign(new StellarSdk.Account(SOURCE, "1"), {
      subentry_count: 0,
      balances: [{ asset_type: "native", balance: "100.0000000" }],
    })
  );
  ledgerCallMock.mockResolvedValue({
    records: [{ base_reserve_in_stroops: "5000000" }],
  });
  submitTransactionMock.mockResolvedValue({ hash: "trusthash", ledger: 9 });
  signTransactionMock.mockImplementation(async (xdr) => ({ signedTxXdr: xdr }));
});

describe("changeTrustWithFreighter", () => {
  it("submits a changeTrust operation with an uppercased 12-character code", async () => {
    await changeTrustWithFreighter(SOURCE, "abcdefghijkl", ISSUER);

    expect(submitTransactionMock).toHaveBeenCalledTimes(1);
    const op = submitTransactionMock.mock.calls[0][0].operations[0];
    expect(op.type).toBe("changeTrust");
    expect(op.line.getCode()).toBe("ABCDEFGHIJKL");
    expect(op.line.getIssuer()).toBe(ISSUER);
  });
});
