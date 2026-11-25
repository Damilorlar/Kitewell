import { describe, expect, it, vi } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import { mapOfferRecord, watchOfferUntilGone } from "./stellar";

const SELLER = StellarSdk.Keypair.random().publicKey();
const ISSUER = StellarSdk.Keypair.random().publicKey();

function offerRecord(amount, price = "0.5000000") {
  return {
    id: "42",
    seller: SELLER,
    amount,
    price,
    price_r: { n: 1, d: 2 },
    selling: { asset_type: "native" },
    buying: {
      asset_type: "credit_alphanum4",
      asset_code: "USDC",
      asset_issuer: ISSUER,
    },
  };
}

function notFound() {
  const error = new Error("Request failed with status code 404");
  error.name = "NotFoundError";
  error.status = 404;
  error.response = { status: 404, data: {} };
  return error;
}

describe("mapOfferRecord", () => {
  it("maps the remaining amount, price, and both assets", () => {
    expect(mapOfferRecord(offerRecord("100.0000000"))).toEqual({
      id: "42",
      seller: SELLER,
      amount: "100.0000000",
      price: "0.5000000",
      selling: "XLM",
      buying: "USDC",
    });
  });
});

describe("watchOfferUntilGone", () => {
  it("walks a shrinking remaining amount and then ends on a 404", async () => {
    const responses = [
      offerRecord("100.0000000", "0.5000000"),
      offerRecord("60.0000000", "0.5100000"),
      offerRecord("25.0000000", "0.5200000"),
      notFound(),
    ];
    const fetchOffer = vi.fn(async () => {
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return next;
    });
    const updates = [];

    const result = await watchOfferUntilGone("42", {
      publicKey: SELLER,
      fetchOffer,
      fetchAccountOffers: async () => ({ records: [{ id: 7 }, { id: 42 }] }),
      sleep: async () => {},
      onUpdate: (offer) =>
        updates.push(offer ? { amount: offer.amount, price: offer.price } : null),
    });

    expect(updates).toEqual([
      { amount: "100.0000000", price: "0.5000000" },
      { amount: "60.0000000", price: "0.5100000" },
      { amount: "25.0000000", price: "0.5200000" },
      null,
    ]);
    expect(fetchOffer).toHaveBeenCalledTimes(4);
    expect(result).toEqual({ status: "gone", stillListed: true });
  });

  it("reports that the account no longer lists a gone offer", async () => {
    const result = await watchOfferUntilGone("42", {
      publicKey: SELLER,
      fetchOffer: async () => {
        throw notFound();
      },
      fetchAccountOffers: async () => ({ records: [{ id: 7 }] }),
      sleep: async () => {},
    });

    expect(result).toEqual({ status: "gone", stillListed: false });
  });

  it("still ends with gone when the account check cannot be read", async () => {
    const result = await watchOfferUntilGone("42", {
      publicKey: SELLER,
      fetchOffer: async () => {
        throw notFound();
      },
      fetchAccountOffers: async () => {
        throw new Error("Horizon unavailable");
      },
      sleep: async () => {},
    });

    expect(result).toEqual({ status: "gone", stillListed: null });
  });

  it("stops on the abort signal without touching the offer", async () => {
    const controller = new AbortController();
    let polls = 0;

    await expect(
      watchOfferUntilGone("42", {
        publicKey: SELLER,
        signal: controller.signal,
        fetchOffer: async () => {
          polls += 1;
          return offerRecord("100.0000000");
        },
        fetchAccountOffers: async () => ({ records: [] }),
        sleep: async () => controller.abort(),
      })
    ).rejects.toMatchObject({ name: "AbortError" });

    // One read happened; stopping never sends a cancel or manage-offer op.
    expect(polls).toBe(1);
  });

  it("rejects a non-numeric offer id before polling", async () => {
    const fetchOffer = vi.fn();

    await expect(
      watchOfferUntilGone("not-an-id", { fetchOffer })
    ).rejects.toThrow(/Offer id must be a positive number/);
    expect(fetchOffer).not.toHaveBeenCalled();
  });

  it("passes a non-404 Horizon error through", async () => {
    const failure = new Error("Horizon is down");
    failure.status = 500;

    await expect(
      watchOfferUntilGone("42", {
        fetchOffer: async () => {
          throw failure;
        },
        sleep: async () => {},
      })
    ).rejects.toThrow("Horizon is down");
  });
});
