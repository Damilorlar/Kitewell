import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CI-friendly tests for `sponsorTrustlineWithFreighter`. Freighter and Horizon
 * are mocked; the real SDK builds the three-operation envelope so the order and
 * operation sources are asserted on the submitted transaction.
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
const { sponsorTrustlineWithFreighter } = await import("./freighter");

const SPONSOR_KEYPAIR = StellarSdk.Keypair.random();
const SPONSORED_KEYPAIR = StellarSdk.Keypair.random();
const SPONSOR = SPONSOR_KEYPAIR.publicKey();
const SPONSORED = SPONSORED_KEYPAIR.publicKey();
const ISSUER = StellarSdk.Keypair.random().publicKey();

function signWith(keypair) {
  return async (xdr, options) => {
    if (options.address !== keypair.publicKey()) return { signedTxXdr: xdr };
    const transaction = StellarSdk.TransactionBuilder.fromXDR(
      xdr,
      StellarSdk.Networks.TESTNET
    );
    transaction.sign(keypair);
    return { signedTxXdr: transaction.toXDR() };
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockResolvedValue(new StellarSdk.Account(SPONSOR, "1"));
  submitTransactionMock.mockResolvedValue({ hash: "sponsorhash", ledger: 8 });
  signTransactionMock.mockImplementation(async (xdr, options) => {
    const keypair =
      options.address === SPONSORED ? SPONSORED_KEYPAIR : SPONSOR_KEYPAIR;
    return signWith(keypair)(xdr, options);
  });
});

const form = {
  publicKey: SPONSOR,
  sponsoredAccount: SPONSORED,
  assetCode: "USDC",
  assetIssuer: ISSUER,
};

describe("sponsorTrustlineWithFreighter", () => {
  it("locks the begin → changeTrust → end operation order", async () => {
    await sponsorTrustlineWithFreighter(form);

    expect(submitTransactionMock).toHaveBeenCalledTimes(1);
    const transaction = submitTransactionMock.mock.calls[0][0];

    expect(transaction.operations.map((op) => op.type)).toEqual([
      "beginSponsoringFutureReserves",
      "changeTrust",
      "endSponsoringFutureReserves",
    ]);
    expect(transaction.operations[0].sponsoredId).toBe(SPONSORED);
    expect(transaction.operations[1].source).toBe(SPONSORED);
    expect(transaction.operations[2].source).toBe(SPONSOR);
    expect(transaction.operations[1].line.getCode()).toBe("USDC");
    expect(transaction.operations[1].line.getIssuer()).toBe(ISSUER);
    expect(transaction.source).toBe(SPONSOR);
    expect(transaction.signatures).toHaveLength(2);
  });

  it("refuses to sponsor the connected account itself", async () => {
    await expect(
      sponsorTrustlineWithFreighter({ ...form, sponsoredAccount: SPONSOR })
    ).rejects.toThrow(/cannot sponsor a trustline for the connected account/);

    expect(submitTransactionMock).not.toHaveBeenCalled();
  });

  it("does not submit when the sponsored account signature is missing", async () => {
    signTransactionMock.mockImplementation(signWith(SPONSOR_KEYPAIR));

    await expect(sponsorTrustlineWithFreighter(form)).rejects.toThrow(
      /Both the sponsor and the sponsored account must sign/
    );

    expect(submitTransactionMock).not.toHaveBeenCalled();
  });
});
