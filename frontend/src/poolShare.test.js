import { describe, expect, it } from "vitest";
import {
  poolSharePercentage,
  poolShareRows,
  reserveAssetLabel,
} from "./poolShare";

const ISSUER = "GISSUERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

/** Horizon liquidity-pool fixture: two reserves and 1000 total shares. */
function poolFixture() {
  return {
    id: "pool-1",
    total_shares: "1000.0000000",
    reserves: [
      { asset: "native", balance: "500.0000000" },
      { asset: `USDC:${ISSUER}`, balance: "250.0000000" },
    ],
  };
}

describe("poolSharePercentage", () => {
  it("computes the share held from a fixture pool", () => {
    expect(poolSharePercentage("250.0000000", "1000.0000000")).toBe("25.00");
  });

  it("truncates instead of rounding up past the real share", () => {
    expect(poolSharePercentage("1.0000000", "3.0000000")).toBe("33.33");
    expect(poolSharePercentage("2.0000000", "3.0000000")).toBe("66.66");
  });

  it("returns null for a pool with no shares or malformed input", () => {
    expect(poolSharePercentage("1.0000000", "0.0000000")).toBeNull();
    expect(poolSharePercentage("not-a-number", "10")).toBeNull();
    expect(poolSharePercentage("1", null)).toBeNull();
  });
});

describe("reserveAssetLabel", () => {
  it("labels native and issued reserves with code and issuer", () => {
    expect(reserveAssetLabel("native")).toBe("XLM (native)");
    expect(reserveAssetLabel(`USDC:${ISSUER}`)).toBe(`USDC:${ISSUER}`);
    expect(reserveAssetLabel({ asset_type: "credit_alphanum4", asset_code: "EURT", asset_issuer: ISSUER })).toBe(
      `EURT:${ISSUER}`
    );
  });
});

describe("poolShareRows", () => {
  it("shows both reserves, total shares, and the user's percentage", () => {
    const balances = [
      { key: "pool:pool-1", code: "POOL", poolId: "pool-1", balance: "250.0000000", isPoolShare: true },
    ];

    const rows = poolShareRows(balances, { "pool-1": poolFixture() });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      poolId: "pool-1",
      shares: "250.0000000",
      totalShares: "1000.0000000",
      percentage: "25.00",
      reservesUnavailable: false,
      loading: false,
    });
    expect(rows[0].reserves).toEqual([
      { label: "XLM (native)", balance: "500.0000000" },
      { label: `USDC:${ISSUER}`, balance: "250.0000000" },
    ]);
  });

  it("does not give a row to a user with zero shares", () => {
    const balances = [
      { key: "pool:pool-1", code: "POOL", poolId: "pool-1", balance: "0.0000000", isPoolShare: true },
      { key: "native", code: "XLM", balance: "1.0000000", isNative: true },
    ];

    expect(poolShareRows(balances, { "pool-1": poolFixture() })).toEqual([]);
    expect(poolShareRows([])).toEqual([]);
  });

  it("keeps the share balance and says the reserves are unavailable", () => {
    const balances = [
      { key: "pool:pool-1", code: "POOL", poolId: "pool-1", balance: "7.0000000", isPoolShare: true },
    ];

    const rows = poolShareRows(balances, { "pool-1": null });

    expect(rows[0]).toMatchObject({
      shares: "7.0000000",
      totalShares: null,
      percentage: null,
      reserves: [],
      reservesUnavailable: true,
      loading: false,
    });
  });

  it("reports a pool that is still loading separately", () => {
    const balances = [
      { key: "pool:pool-1", code: "POOL", poolId: "pool-1", balance: "7.0000000", isPoolShare: true },
    ];

    const rows = poolShareRows(balances, {});
    expect(rows[0].loading).toBe(true);
    expect(rows[0].reservesUnavailable).toBe(false);
  });
});
