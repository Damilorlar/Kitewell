import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CI-friendly tests for the sponsored account creation flow.
 * Freighter and Horizon are mocked; the real SDK builds the transaction.
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
  signAuthEntry: vi.fn(),
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
const {
  buildSponsoredAccountCreationEnvelope,
  sponsorAccountCreationWithFreighter,
} = await import("./freighter");

const SPONSOR = StellarSdk.Keypair.random();
const NEW_ACCOUNT = StellarSdk.Keypair.random();
const OTHER_ACCOUNT = StellarSdk.Keypair.random();

function draftXdr({ newAccount = NEW_ACCOUNT, sequence = "5" } = {}) {
  return buildSponsoredAccountCreationEnvelope({
    sponsor: SPONSOR.publicKey(),
    newAccount: newAccount.publicKey(),
    sequence,
  }).toXDR();
}

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockResolvedValue(
    new StellarSdk.Account(SPONSOR.publicKey(), "5")
  );
});

describe("buildSponsoredAccountCreationEnvelope", () => {
  it("locks the three-operation order and the zero starting balance", () => {
    const transaction = buildSponsoredAccountCreationEnvelope({
      sponsor: SPONSOR.publicKey(),
      newAccount: NEW_ACCOUNT.publicKey(),
      sequence: "5",
    });

    expect(transaction.operations).toHaveLength(3);
    expect(transaction.operations[0].type).toBe(
      "beginSponsoringFutureReserves"
    );
    expect(transaction.operations[0].sponsoredId).toBe(NEW_ACCOUNT.publicKey());
    expect(transaction.operations[1].type).toBe("createAccount");
    expect(transaction.operations[1].destination).toBe(NEW_ACCOUNT.publicKey());
    // The SDK normalizes the amount, but the starting balance is zero.
    expect(Number(transaction.operations[1].startingBalance)).toBe(0);
    expect(transaction.operations[2].type).toBe("endSponsoringFutureReserves");
  });

  it("refuses to sponsor the connected account itself", () => {
    expect(() =>
      buildSponsoredAccountCreationEnvelope({
        sponsor: SPONSOR.publicKey(),
        newAccount: SPONSOR.publicKey(),
        sequence: "5",
      })
    ).toThrow(/itself is not allowed/);
  });
});

describe("sponsorAccountCreationWithFreighter", () => {
  it("refuses a missing second signature without signing or submitting", async () => {
    await expect(
      sponsorAccountCreationWithFreighter(
        SPONSOR.publicKey(),
        NEW_ACCOUNT.publicKey(),
        ""
      )
    ).rejects.toThrow(/co-sign/);

    expect(loadAccountMock).not.toHaveBeenCalled();
    expect(signTransactionMock).not.toHaveBeenCalled();
    expect(submitTransactionMock).not.toHaveBeenCalled();
  });

  it("refuses an envelope without the new account's signature", async () => {
    await expect(
      sponsorAccountCreationWithFreighter(
        SPONSOR.publicKey(),
        NEW_ACCOUNT.publicKey(),
        draftXdr()
      )
    ).rejects.toThrow(/missing the new account's signature/);

    expect(signTransactionMock).not.toHaveBeenCalled();
    expect(submitTransactionMock).not.toHaveBeenCalled();
  });

  it("refuses a co-signed envelope for a different transaction", async () => {
    const otherDraft = StellarSdk.TransactionBuilder.fromXDR(
      draftXdr({ newAccount: OTHER_ACCOUNT }),
      StellarSdk.Networks.TESTNET
    );
    otherDraft.sign(NEW_ACCOUNT);

    await expect(
      sponsorAccountCreationWithFreighter(
        SPONSOR.publicKey(),
        NEW_ACCOUNT.publicKey(),
        otherDraft.toXDR()
      )
    ).rejects.toThrow(/does not match this sponsorship transaction/);

    expect(submitTransactionMock).not.toHaveBeenCalled();
  });

  it("submits only once the new account has co-signed", async () => {
    const coSigned = StellarSdk.TransactionBuilder.fromXDR(
      draftXdr(),
      StellarSdk.Networks.TESTNET
    );
    coSigned.sign(NEW_ACCOUNT);
    signTransactionMock.mockResolvedValue({
      signedTxXdr: coSigned.toXDR(),
    });
    submitTransactionMock.mockResolvedValue({
      hash: "a".repeat(64),
      successful: true,
    });

    const result = await sponsorAccountCreationWithFreighter(
      SPONSOR.publicKey(),
      NEW_ACCOUNT.publicKey(),
      coSigned.toXDR()
    );

    expect(signTransactionMock).toHaveBeenCalledTimes(1);
    expect(submitTransactionMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      hash: "a".repeat(64),
      newAccount: NEW_ACCOUNT.publicKey(),
      sponsor: SPONSOR.publicKey(),
      confirmed: true,
    });
  });
});
