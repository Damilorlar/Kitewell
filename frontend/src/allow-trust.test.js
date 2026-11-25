import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CI-friendly tests for issuer trustline control: the accounts-for-asset read
 * and allowTrust authorize/revoke transaction building. Freighter and Horizon
 * are mocked; the real SDK builds the operations.
 */

const {
  loadAccountMock,
  submitTransactionMock,
  signTransactionMock,
  assetsCallMock,
  accountsCallMock,
} = vi.hoisted(() => ({
  loadAccountMock: vi.fn(),
  submitTransactionMock: vi.fn(),
  signTransactionMock: vi.fn(),
  assetsCallMock: vi.fn(),
  accountsCallMock: vi.fn(),
}));

vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(),
  setAllowed: vi.fn(),
  getAddress: vi.fn(),
  getNetwork: vi.fn(),
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
          assets: () => ({
            forIssuer: () => ({ limit: () => ({ call: assetsCallMock }) }),
          }),
          accounts: () => ({
            forAsset: () => ({ limit: () => ({ call: accountsCallMock }) }),
          }),
        };
      }),
    },
  };
});

const StellarSdk = await import("@stellar/stellar-sdk");
const { getIssuedAssetTrustlines } = await import("./stellar");
const { allowTrustWithFreighter } = await import("./freighter");

const ISSUER = StellarSdk.Keypair.random().publicKey();
const HOLDER = StellarSdk.Keypair.random().publicKey();

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockResolvedValue(new StellarSdk.Account(ISSUER, "1"));
  submitTransactionMock.mockResolvedValue({ hash: "allowhash" });
  signTransactionMock.mockImplementation(async (xdr) => ({ signedTxXdr: xdr }));
});

describe("getIssuedAssetTrustlines", () => {
  it("reads holders from accounts-for-asset and maps their balance rows", async () => {
    assetsCallMock.mockResolvedValue({
      records: [{ asset_code: "USDC", asset_issuer: ISSUER }],
    });
    accountsCallMock.mockResolvedValue({
      records: [
        {
          account_id: HOLDER,
          balances: [
            {
              asset_type: "credit_alphanum4",
              asset_code: "USDC",
              asset_issuer: ISSUER,
              balance: "12.0000000",
              limit: "1000.0000000",
              is_authorized: true,
            },
          ],
        },
      ],
    });

    await expect(getIssuedAssetTrustlines(ISSUER)).resolves.toEqual([
      {
        key: `USDC:${HOLDER}`,
        assetCode: "USDC",
        assetIssuer: ISSUER,
        holder: HOLDER,
        balance: "12.0000000",
        limit: "1000.0000000",
        isAuthorized: true,
      },
    ]);
    expect(accountsCallMock).toHaveBeenCalledTimes(1);
  });

  it("queries one asset directly when a code is supplied", async () => {
    accountsCallMock.mockResolvedValue({ records: [] });

    await expect(getIssuedAssetTrustlines(ISSUER, "usdc")).resolves.toEqual([]);
    expect(assetsCallMock).not.toHaveBeenCalled();
    expect(accountsCallMock).toHaveBeenCalledTimes(1);
  });

  it("returns an empty list when the issuer has no assets", async () => {
    assetsCallMock.mockResolvedValue({ records: [] });
    await expect(getIssuedAssetTrustlines(ISSUER)).resolves.toEqual([]);
    expect(accountsCallMock).not.toHaveBeenCalled();
  });
});

describe("allowTrustWithFreighter", () => {
  it("builds allowTrust to authorize a holder", async () => {
    await allowTrustWithFreighter(ISSUER, {
      holder: HOLDER,
      assetCode: "usdc",
      assetIssuer: ISSUER,
      authorize: true,
    });

    const op = submitTransactionMock.mock.calls[0][0].operations[0];
    expect(op.type).toBe("allowTrust");
    expect(op.trustor).toBe(HOLDER);
    expect(op.assetCode).toBe("USDC");
    expect(Boolean(op.authorize)).toBe(true);
    expect(signTransactionMock).toHaveBeenCalledTimes(1);
  });

  it("builds allowTrust to revoke a holder", async () => {
    await allowTrustWithFreighter(ISSUER, {
      holder: HOLDER,
      assetCode: "USDC",
      assetIssuer: ISSUER,
      authorize: false,
    });

    const op = submitTransactionMock.mock.calls[0][0].operations[0];
    expect(op.type).toBe("allowTrust");
    expect(Boolean(op.authorize)).toBe(false);
  });

  it("refuses an asset the connected account does not issue", async () => {
    await expect(
      allowTrustWithFreighter(ISSUER, {
        holder: HOLDER,
        assetCode: "USDC",
        assetIssuer: HOLDER,
        authorize: true,
      })
    ).rejects.toThrow(/Only the issuer/);
    expect(submitTransactionMock).not.toHaveBeenCalled();
  });

  it("surfaces Horizon's failure when a revocation is rejected", async () => {
    const failure = new Error("Horizon rejected the revoke");
    submitTransactionMock.mockRejectedValue(failure);

    await expect(
      allowTrustWithFreighter(ISSUER, {
        holder: HOLDER,
        assetCode: "USDC",
        assetIssuer: ISSUER,
        authorize: false,
      })
    ).rejects.toBe(failure);
  });
});
