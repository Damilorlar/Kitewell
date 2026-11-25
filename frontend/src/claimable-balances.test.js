import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadAccountMock, submitTransactionMock, signTransactionMock, claimableCallMock } =
  vi.hoisted(() => ({
    loadAccountMock: vi.fn(),
    submitTransactionMock: vi.fn(),
    signTransactionMock: vi.fn(),
    claimableCallMock: vi.fn(),
  }));

vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(),
  setAllowed: vi.fn(),
  getAddress: vi.fn(),
  getNetwork: vi.fn().mockResolvedValue({
    network: "TESTNET",
    networkPassphrase: "Test SDF Network ; September 2015",
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
          claimableBalances: () => ({
            claimant: () => ({
              limit: () => ({
                order: () => ({ call: claimableCallMock }),
              }),
            }),
          }),
        };
      }),
    },
  };
});

const StellarSdk = await import("@stellar/stellar-sdk");
const {
  createClaimableBalanceWithFreighter,
  claimClaimableBalanceWithFreighter,
  buildClaimPredicate,
} = await import("./freighter");
const { getClaimableBalances } = await import("./stellar");

const SOURCE = StellarSdk.Keypair.random().publicKey();
const CLAIMANT = StellarSdk.Keypair.random().publicKey();
const ISSUER = StellarSdk.Keypair.random().publicKey();

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockResolvedValue(new StellarSdk.Account(SOURCE, "7"));
  submitTransactionMock.mockResolvedValue({
    hash: "claimablehash",
    ledger: 123,
  });
  signTransactionMock.mockImplementation(async (xdr) => ({ signedTxXdr: xdr }));
  claimableCallMock.mockResolvedValue({
    records: [
      {
        id: "0".repeat(72),
        amount: "5.0000000",
        asset: "native",
        claimants: [],
      },
    ],
  });
});

describe("claimable balance operations", () => {
  it("builds a native create claimable balance operation", async () => {
    await createClaimableBalanceWithFreighter({
      publicKey: SOURCE,
      claimant: CLAIMANT,
      amount: "5",
      asset: { isNative: true },
    });

    const tx = submitTransactionMock.mock.calls[0][0];
    expect(tx.operations).toHaveLength(1);
    expect(tx.operations[0].type).toBe("createClaimableBalance");
    expect(tx.operations[0].asset.isNative()).toBe(true);
    expect(tx.operations[0].amount).toBe("5.0000000");
    expect(tx.operations[0].claimants).toHaveLength(1);
    expect(tx.operations[0].claimants[0].destination).toBe(CLAIMANT);
  });

  it("builds a credit asset create operation and predicate", async () => {
    await createClaimableBalanceWithFreighter({
      publicKey: SOURCE,
      claimant: CLAIMANT,
      amount: "2.25",
      asset: { isNative: false, code: "USDC", issuer: ISSUER },
      predicateMode: "notAfter",
      ledgerTime: "1900000000",
    });

    const op = submitTransactionMock.mock.calls[0][0].operations[0];
    expect(op.asset.isNative()).toBe(false);
    expect(op.asset.getCode()).toBe("USDC");
    expect(op.asset.getIssuer()).toBe(ISSUER);
    expect(op.amount).toBe("2.2500000");
  });

  it("builds not-before and not-after predicates", () => {
    const notBefore = buildClaimPredicate("notBefore", "1900000000");
    expect(notBefore.switch().name).toBe("claimPredicateNot");

    const notAfter = buildClaimPredicate("notAfter", "1900000000");
    expect(notAfter.switch().name).toBe("claimPredicateBeforeAbsoluteTime");
  });

  it("refuses a credit asset the caller does not hold before Freighter", async () => {
    await expect(
      createClaimableBalanceWithFreighter({
        publicKey: SOURCE,
        claimant: CLAIMANT,
        amount: "1",
        asset: null,
      })
    ).rejects.toThrow("Choose an asset");

    expect(signTransactionMock).not.toHaveBeenCalled();
    expect(submitTransactionMock).not.toHaveBeenCalled();
  });

  it("builds a claim operation with the balance id", async () => {
    const balanceId = `00000000${"ab".repeat(32)}`;
    await claimClaimableBalanceWithFreighter(SOURCE, balanceId);

    const op = submitTransactionMock.mock.calls[0][0].operations[0];
    expect(op.type).toBe("claimClaimableBalance");
    expect(op.balanceId).toBe(balanceId);
  });

  it("lists balances claimable by the connected account", async () => {
    await expect(getClaimableBalances(SOURCE)).resolves.toEqual([
      expect.objectContaining({
        id: "0".repeat(72),
        asset: "XLM",
        amount: "5.0000000",
      }),
    ]);
  });
});
