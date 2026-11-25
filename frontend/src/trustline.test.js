import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CI-friendly tests for `changeTrustWithFreighter`, focused on the limit-0
 * removal path used by the Assets tab. Freighter and Horizon are mocked; the
 * real SDK builds the operation.
 */

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
            order: () => ({
              limit: () => ({ call: ledgerCallMock }),
            }),
          }),
        };
      }),
    },
  };
});

const StellarSdk = await import("@stellar/stellar-sdk");
const {
  changeTrustWithFreighter,
  createAccountWithFreighter,
} = await import("./freighter");

const SOURCE = StellarSdk.Keypair.random().publicKey();
const ISSUER = StellarSdk.Keypair.random().publicKey();
const DESTINATION = StellarSdk.Keypair.random().publicKey();

function sourceAccount(balance = "100.0000000", subentries = 0) {
  return Object.assign(new StellarSdk.Account(SOURCE, "1"), {
    subentry_count: subentries,
    balances: [{ asset_type: "native", balance }],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockResolvedValue(sourceAccount());
  submitTransactionMock.mockResolvedValue({ hash: "trusthash", ledger: 9 });
  ledgerCallMock.mockResolvedValue({
    records: [{ base_reserve_in_stroops: "5000000" }],
  });
  signTransactionMock.mockImplementation(async (xdr) => ({
    signedTxXdr: xdr,
  }));
});

describe("changeTrustWithFreighter", () => {
  it("builds a changeTrust op with limit 0 to remove a trustline", async () => {
    await changeTrustWithFreighter(SOURCE, "usdc", ISSUER, "0");

    expect(loadAccountMock).toHaveBeenCalledWith(SOURCE);
    expect(submitTransactionMock).toHaveBeenCalledTimes(1);

    const op = submitTransactionMock.mock.calls[0][0].operations[0];
    expect(op.type).toBe("changeTrust");
    expect(op.limit).toBe("0.0000000");
    expect(op.line.getCode()).toBe("USDC");
    expect(op.line.getIssuer()).toBe(ISSUER);
  });

  it("defaults to a positive limit when none is given", async () => {
    await changeTrustWithFreighter(SOURCE, "USDC", ISSUER);

    const op = submitTransactionMock.mock.calls[0][0].operations[0];
    expect(parseFloat(op.limit)).toBeGreaterThan(0);
  });

  it("rejects an invalid issuer before submitting", async () => {
    await expect(
      changeTrustWithFreighter(SOURCE, "USDC", "not-a-key", "0")
    ).rejects.toThrow(/valid Stellar public key/);

    expect(submitTransactionMock).not.toHaveBeenCalled();
  });

  it("refuses a new trustline when two subentries leave no room for reserve and fee", async () => {
    loadAccountMock.mockResolvedValue(sourceAccount("2.5000000", 2));

    await expect(
      changeTrustWithFreighter(SOURCE, "USDC", ISSUER)
    ).rejects.toThrow(/needs 2\.5000100 XLM/);

    expect(signTransactionMock).not.toHaveBeenCalled();
    expect(submitTransactionMock).not.toHaveBeenCalled();
  });

  it("does not open Freighter when the latest ledger reserve cannot be loaded", async () => {
    ledgerCallMock.mockRejectedValue(new Error("Horizon ledger unavailable"));

    await expect(
      changeTrustWithFreighter(SOURCE, "USDC", ISSUER)
    ).rejects.toThrow("Horizon ledger unavailable");

    expect(signTransactionMock).not.toHaveBeenCalled();
    expect(submitTransactionMock).not.toHaveBeenCalled();
  });

  it("creates an account when both reserve checks pass", async () => {
    await createAccountWithFreighter(SOURCE, DESTINATION, "2.5");

    const operation = submitTransactionMock.mock.calls[0][0].operations[0];
    expect(operation.type).toBe("createAccount");
    expect(operation.destination).toBe(DESTINATION);
    expect(operation.startingBalance).toBe("2.5000000");
    expect(signTransactionMock).toHaveBeenCalledTimes(1);
  });

  it("refuses account creation when the source would fall below its minimum", async () => {
    loadAccountMock.mockResolvedValue(sourceAccount("4.5000000", 2));

    await expect(
      createAccountWithFreighter(SOURCE, DESTINATION, "2.5")
    ).rejects.toThrow(/source must retain 2\.0000000 XLM/);

    expect(signTransactionMock).not.toHaveBeenCalled();
    expect(submitTransactionMock).not.toHaveBeenCalled();
  });
});
