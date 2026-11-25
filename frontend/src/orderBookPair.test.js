import { afterEach, describe, expect, it, vi } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import {
  ORDER_BOOK_PAIR_STORAGE_KEY,
  clearStoredOrderBookPair,
  parseOrderBookPair,
  readStoredOrderBookPair,
  saveOrderBookPair,
} from "./orderBookPair";

function storageFixture() {
  const values = new Map();
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
    removeItem: vi.fn((key) => values.delete(key)),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("remembered order book pair", () => {
  const issuer = StellarSdk.Keypair.random().publicKey();
  const fixture = { selling: "XLM", buying: `USDC:${issuer}` };

  it("restores the last loaded pair and clears it", () => {
    const storage = storageFixture();
    vi.stubGlobal("localStorage", storage);

    saveOrderBookPair(fixture);
    expect(storage.setItem).toHaveBeenCalledWith(
      ORDER_BOOK_PAIR_STORAGE_KEY,
      JSON.stringify(fixture)
    );
    expect(readStoredOrderBookPair()).toEqual(fixture);
    expect(parseOrderBookPair(readStoredOrderBookPair())).not.toBeNull();

    clearStoredOrderBookPair();
    expect(readStoredOrderBookPair()).toEqual({ selling: "", buying: "" });
  });

  it("drops a stored value that is not a Stellar asset", () => {
    const storage = storageFixture();
    vi.stubGlobal("localStorage", storage);
    storage.setItem(ORDER_BOOK_PAIR_STORAGE_KEY, JSON.stringify({
      selling: "XLM",
      buying: "USDC:not-an-issuer",
    }));

    expect(readStoredOrderBookPair()).toEqual({ selling: "XLM", buying: "" });
    expect(parseOrderBookPair(readStoredOrderBookPair())).toBeNull();
    expect(storage.getItem(ORDER_BOOK_PAIR_STORAGE_KEY)).toBeTruthy();
  });

  it("does not accept incomplete or identical pairs", () => {
    expect(parseOrderBookPair({ selling: "XLM", buying: "" })).toBeNull();
    expect(parseOrderBookPair({ selling: "XLM", buying: "xlm" })).toBeNull();
    expect(parseOrderBookPair(fixture)?.buying.getIssuer()).toBe(issuer);
  });
});
