import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CI-friendly tests for `clawbackWithFreighter`. Freighter and Horizon are
 * mocked; the real SDK builds the clawback operation and the holder balance
 * comes from a Horizon fixture.
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
const { clawbackWithFreighter } = await import("./freighter");

const ISSUER = StellarSdk.Keypair.random().publicKey();
const HOLDER = StellarSdk.Keypair.random().publicKey();
const OTHER_ISSUER = StellarSdk.Keypair.random().publicKey();

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockImplementation(async (address) =>
    address === HOLDER
      ? {
          balances: [
            {
              asset_type: "credit_alphanum4",
              asset_code: "USDC",
              asset_issuer: ISSUER,
              balance: "100.0000000",
              limit: "1000.0000000",
            },
          ],
        }
      : new StellarSdk.Account(ISSUER, "1")
  );
  submitTransactionMock.mockResolvedValue({ hash: "clawbackhash", ledger: 4 });
  signTransactionMock.mockImplementation(async (xdr) => ({
    signedTxXdr: xdr,
  }));
});

describe("clawbackWithFreighter", () => {
  it("builds a clawback op from the issuer for the holder's balance", async () => {
    await clawbackWithFreighter(ISSUER, HOLDER, "usdc", ISSUER, "40");

    expect(loadAccountMock).toHaveBeenCalledWith(HOLDER);
    expect(submitTransactionMock).toHaveBeenCalledTimes(1);

    const op = submitTransactionMock.mock.calls[0][0].operations[0];
    expect(op.type).toBe("clawback");
    expect(op.from).toBe(HOLDER);
    expect(op.amount).toBe("40.0000000");
    expect(op.asset.getCode()).toBe("USDC");
    expect(op.asset.getIssuer()).toBe(ISSUER);
  });

  it("refuses an amount above the holder's balance before signing", async () => {
    await expect(
      clawbackWithFreighter(ISSUER, HOLDER, "USDC", ISSUER, "100.0000001")
    ).rejects.toThrow(/exceeds the holder's USDC balance/);

    expect(signTransactionMock).not.toHaveBeenCalled();
    expect(submitTransactionMock).not.toHaveBeenCalled();
  });

  it("refuses an asset the connected account does not issue", async () => {
    await expect(
      clawbackWithFreighter(ISSUER, HOLDER, "USDC", OTHER_ISSUER, "1")
    ).rejects.toThrow(/Only the asset issuer/);

    expect(submitTransactionMock).not.toHaveBeenCalled();
  });
});
