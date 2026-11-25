import { describe, expect, it } from "vitest";
import { appendEffect, labelEffect } from "./accountEffects";

describe("labelEffect", () => {
  it("labels a trustline effect with its type and asset", () => {
    const labelled = labelEffect({
      type: "trustline_created",
      asset_type: "credit_alphanum4",
      asset_code: "USDC",
      asset_issuer: "GISSUER",
      limit: "1000.0000000",
    });

    expect(labelled).toEqual({
      type: "trustline_created",
      label: "Trustline created for USDC:GISSUER",
    });
  });

  it("labels trades, offers, and account credits/debits", () => {
    expect(
      labelEffect({
        type: "trade",
        sold_amount: "10.0000000",
        sold_asset_type: "native",
        bought_amount: "9.5000000",
        bought_asset_type: "credit_alphanum4",
        bought_asset_code: "USDC",
        bought_asset_issuer: "GISSUER",
      }).label
    ).toBe("Trade: 10.0000000 XLM → 9.5000000 USDC:GISSUER");

    expect(
      labelEffect({
        type: "offer_created",
        amount: "2.0000000",
        asset_type: "native",
      }).label
    ).toBe("Offer created: selling 2.0000000 XLM");

    expect(
      labelEffect({
        type: "account_credited",
        amount: "1.0000000",
        asset_type: "native",
      }).label
    ).toBe("Account credited 1.0000000 XLM");

    expect(
      labelEffect({
        type: "account_debited",
        amount: "3.0000000",
        asset_type: "credit_alphanum4",
        asset_code: "EURT",
        asset_issuer: "GISSUER",
      }).label
    ).toBe("Account debited 3.0000000 EURT:GISSUER");
  });

  it("keeps an unknown effect type raw with no invented story", () => {
    expect(labelEffect({ type: "signer_created", weight: 1 })).toEqual({
      type: "signer_created",
      label: null,
    });
    expect(labelEffect({})).toEqual({ type: "unknown", label: null });
  });
});

describe("appendEffect", () => {
  it("appends an effect once and skips a duplicate paging token", () => {
    const effect = { type: "trade", paging_token: "123-1" };
    const first = appendEffect([], effect);

    expect(first).toEqual([effect]);
    expect(appendEffect(first, { ...effect, type: "trade" })).toBe(first);
  });

  it("appends effects without a paging token", () => {
    const list = appendEffect([], { type: "trade" });
    expect(appendEffect(list, { type: "trade" })).toHaveLength(2);
  });
});
