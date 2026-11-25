import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadAccount, submitTransaction, signTransaction, offersCall, offerCall } = vi.hoisted(() => ({
  loadAccount: vi.fn(),
  submitTransaction: vi.fn(),
  signTransaction: vi.fn(),
  offersCall: vi.fn(),
  offerCall: vi.fn(),
}));

vi.mock("@stellar/freighter-api", () => ({
  getNetwork: vi.fn(async () => {
    const { getActiveNetwork } = await import("./network");
    const active = getActiveNetwork();
    return { network: active.id, networkPassphrase: active.passphrase };
  }),
  signTransaction,
}));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: vi.fn(function () {
        return {
          loadAccount,
          submitTransaction,
          offers: () => ({
            forAccount: () => ({ limit: () => ({ call: offersCall }) }),
            offer: () => ({ call: offerCall }),
          }),
        };
      }),
    },
  };
});

const StellarSdk = await import("@stellar/stellar-sdk");
const { changeOfferPriceWithFreighter } = await import("./freighter");
const { getOpenOffers } = await import("./stellar");

const seller = StellarSdk.Keypair.random().publicKey();
const issuer = StellarSdk.Keypair.random().publicKey();
const offer = {
  id: "12345",
  seller,
  selling: { asset_type: "credit_alphanum4", asset_code: "USD", asset_issuer: issuer },
  buying: { asset_type: "native" },
  amount: "3.5000000",
  price: "2.0000000",
};

beforeEach(() => {
  vi.clearAllMocks();
  loadAccount.mockResolvedValue(new StellarSdk.Account(seller, "1"));
  submitTransaction.mockResolvedValue({ hash: "updated" });
  offerCall.mockResolvedValue(offer);
  signTransaction.mockImplementation(async (xdr) => ({ signedTxXdr: xdr }));
});

describe("open offer price change", () => {
  it("loads the account's open offers", async () => {
    offersCall.mockResolvedValue({ records: [offer] });
    expect(await getOpenOffers(seller)).toEqual([offer]);
    expect(offersCall).toHaveBeenCalledOnce();
  });

  it("loads offers beyond the first Horizon page", async () => {
    const next = vi.fn().mockResolvedValue({ records: [offer] });
    offersCall.mockResolvedValue({ records: Array(200).fill(offer), next });
    expect(await getOpenOffers(seller)).toHaveLength(201);
    expect(next).toHaveBeenCalledOnce();
  });

  it("submits one manageSellOffer with the existing id and remaining amount", async () => {
    await expect(changeOfferPriceWithFreighter(seller, offer, "2.25"))
      .resolves.toEqual({ hash: "updated", oldPrice: offer.price });

    const transaction = submitTransaction.mock.calls[0][0];
    expect(transaction.operations).toHaveLength(1);
    const operation = transaction.operations[0];
    expect(operation.type).toBe("manageSellOffer");
    expect(operation.offerId).toBe(offer.id);
    expect(operation.amount).toBe(offer.amount);
    expect(operation.price).toBe("2.25");
    expect(operation.selling.getCode()).toBe("USD");
    expect(operation.selling.getIssuer()).toBe(issuer);
    expect(operation.buying.isNative()).toBe(true);
    expect(signTransaction).toHaveBeenCalledOnce();
  });

  it("uses the latest remaining amount after a partial fill", async () => {
    offerCall.mockResolvedValue({ ...offer, amount: "1.2500000", price: "2.1000000" });
    const result = await changeOfferPriceWithFreighter(seller, offer, "2.5");
    expect(submitTransaction.mock.calls[0][0].operations[0].amount).toBe("1.2500000");
    expect(result.oldPrice).toBe("2.1000000");
  });

  it("refuses an offer owned by another account", async () => {
    offerCall.mockResolvedValue({ ...offer, seller: issuer });
    await expect(changeOfferPriceWithFreighter(seller, offer, "2.5"))
      .rejects.toThrow(/no longer open for the connected account/);
    expect(submitTransaction).not.toHaveBeenCalled();
  });

  it.each(["0", "0.0000000", "-1", "", "abc"])(
    "rejects an invalid price %s before signing",
    async (price) => {
      await expect(changeOfferPriceWithFreighter(seller, offer, price))
        .rejects.toThrow(/greater than zero/);
      expect(loadAccount).not.toHaveBeenCalled();
      expect(signTransaction).not.toHaveBeenCalled();
    }
  );

  it("rejects a missing offer id instead of creating an offer", async () => {
    await expect(changeOfferPriceWithFreighter(seller, { ...offer, id: "0" }, "3"))
      .rejects.toThrow(/Select an open offer/);
    expect(loadAccount).not.toHaveBeenCalled();
  });
});
