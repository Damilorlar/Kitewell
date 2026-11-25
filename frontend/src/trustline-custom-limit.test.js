import { beforeEach, describe, expect, it, vi } from "vitest";

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
  signTransactionMock.mockImplementation(async (xdr) => ({
    signedTxXdr: xdr,
  }));
});

describe("changeTrustWithFreighter custom limit", () => {
  it("submits a 1.5 limit formatted to seven decimal places", async () => {
    await changeTrustWithFreighter(SOURCE, "usdc", ISSUER, "1.5");

    expect(loadAccountMock).toHaveBeenCalledWith(SOURCE);
    expect(submitTransactionMock).toHaveBeenCalledTimes(1);

    const op = submitTransactionMock.mock.calls[0][0].operations[0];
    expect(op.type).toBe("changeTrust");
    expect(op.limit).toBe("1.5000000");
    expect(op.line.getCode()).toBe("USDC");
    expect(op.line.getIssuer()).toBe(ISSUER);
  });
});
