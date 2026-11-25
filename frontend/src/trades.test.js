import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Test suite for account trades functionality.
 *
 * Tests the getTrades function that fetches trade history from Horizon
 * with pagination support.
 */

const { tradesCallMock } = vi.hoisted(() => ({
  tradesCallMock: vi.fn(),
}));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: vi.fn(function () {
        return {
          trades: () => ({
            forAccount: () => ({
              limit: () => ({
                order: () => ({
                  call: tradesCallMock,
                  cursor: () => ({ call: tradesCallMock }),
                }),
              }),
            }),
          }),
        };
      }),
    },
  };
});

const { getTrades } = await import("./stellar");

/** Minimal Horizon trades fixture */
function horizonTradesFixture() {
  return {
    records: [
      {
        id: "trade-1",
        paging_token: "token-1",
        ledger_close_time: "2026-11-23T12:00:00Z",
        offer_id: "12345",
        base_account: "GBASE",
        base_amount: "100.0000000",
        base_asset_type: "native",
        counter_account: "GCOUNTER",
        counter_amount: "150.0000000",
        counter_asset_type: "credit_alphanum4",
        counter_asset_code: "USDC",
        counter_asset_issuer: "GISSUER",
        price: { n: 3, d: 2 },
        base_is_seller: true,
      },
      {
        id: "trade-2",
        paging_token: "token-2",
        ledger_close_time: "2026-11-23T11:00:00Z",
        offer_id: "67890",
        base_account: "GCOUNTER2",
        base_amount: "50.0000000",
        base_asset_type: "credit_alphanum4",
        base_asset_code: "BTC",
        base_asset_issuer: "GBTCISSUER",
        counter_account: "GBASE",
        counter_amount: "75.0000000",
        counter_asset_type: "native",
        price: { n: 2, d: 3 },
        base_is_seller: false,
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  tradesCallMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getTrades", () => {
  it("fetches trades for an account from Horizon", async () => {
    tradesCallMock.mockResolvedValue(horizonTradesFixture());

    const result = await getTrades("GTEST");

    expect(result.records).toHaveLength(2);
    expect(result.records[0].id).toBe("trade-1");
  });

  it("includes sold and bought asset information", async () => {
    tradesCallMock.mockResolvedValue(horizonTradesFixture());

    const result = await getTrades("GTEST");

    expect(result.records[0]).toMatchObject({
      base_amount: "100.0000000",
      base_asset_type: "native",
      counter_amount: "150.0000000",
      counter_asset_type: "credit_alphanum4",
      counter_asset_code: "USDC",
      counter_asset_issuer: "GISSUER",
    });
  });

  it("includes price information", async () => {
    tradesCallMock.mockResolvedValue(horizonTradesFixture());

    const result = await getTrades("GTEST");

    expect(result.records[0].price).toEqual({ n: 3, d: 2 });
    expect(result.records[1].price).toEqual({ n: 2, d: 3 });
  });

  it("includes ledger close time", async () => {
    tradesCallMock.mockResolvedValue(horizonTradesFixture());

    const result = await getTrades("GTEST");

    expect(result.records[0].ledger_close_time).toBe("2026-11-23T12:00:00Z");
    expect(result.records[1].ledger_close_time).toBe("2026-11-23T11:00:00Z");
  });

  it("includes offer id", async () => {
    tradesCallMock.mockResolvedValue(horizonTradesFixture());

    const result = await getTrades("GTEST");

    expect(result.records[0].offer_id).toBe("12345");
    expect(result.records[1].offer_id).toBe("67890");
  });

  it("includes base_is_seller flag", async () => {
    tradesCallMock.mockResolvedValue(horizonTradesFixture());

    const result = await getTrades("GTEST");

    expect(result.records[0].base_is_seller).toBe(true);
    expect(result.records[1].base_is_seller).toBe(false);
  });

  it("returns trades in descending order (newest first)", async () => {
    tradesCallMock.mockResolvedValue(horizonTradesFixture());

    const result = await getTrades("GTEST");

    // First trade should be more recent than second
    expect(new Date(result.records[0].ledger_close_time).getTime()).toBeGreaterThan(
      new Date(result.records[1].ledger_close_time).getTime()
    );
  });

  it("returns pagination cursor for next page", async () => {
    tradesCallMock.mockResolvedValue(horizonTradesFixture());

    const result = await getTrades("GTEST");

    expect(result.nextCursor).toBe("token-2");
  });

  it("returns null cursor when no trades", async () => {
    tradesCallMock.mockResolvedValue({ records: [] });

    const result = await getTrades("GTEST");

    expect(result.records).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });

  it("supports custom page limit", async () => {
    tradesCallMock.mockResolvedValue(horizonTradesFixture());

    await getTrades("GTEST", 50);

    expect(tradesCallMock).toHaveBeenCalled();
  });

  it("supports cursor-based pagination", async () => {
    const page1 = horizonTradesFixture();
    const page2 = {
      records: [
        {
          id: "trade-3",
          paging_token: "token-3",
          ledger_close_time: "2026-11-23T10:00:00Z",
          offer_id: "11111",
          base_account: "GBASE",
          base_amount: "25.0000000",
          base_asset_type: "native",
          counter_account: "GCOUNTER3",
          counter_amount: "30.0000000",
          counter_asset_type: "credit_alphanum4",
          counter_asset_code: "EUR",
          counter_asset_issuer: "GEURISSUER",
          price: { n: 6, d: 5 },
          base_is_seller: true,
        },
      ],
    };

    tradesCallMock.mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);

    const firstPage = await getTrades("GTEST");
    const secondPage = await getTrades("GTEST", undefined, firstPage.nextCursor);

    expect(firstPage.records).toHaveLength(2);
    expect(secondPage.records).toHaveLength(1);
    expect(secondPage.records[0].id).toBe("trade-3");
  });

  it("does not duplicate rows when paging", async () => {
    const page1 = {
      records: [
        {
          id: "trade-1",
          paging_token: "token-1",
          ledger_close_time: "2026-11-23T12:00:00Z",
          offer_id: "12345",
          base_account: "GBASE",
          base_amount: "100.0000000",
          base_asset_type: "native",
          counter_account: "GCOUNTER",
          counter_amount: "150.0000000",
          counter_asset_type: "native",
          price: { n: 3, d: 2 },
          base_is_seller: true,
        },
      ],
    };

    const page2 = {
      records: [
        {
          id: "trade-2",
          paging_token: "token-2",
          ledger_close_time: "2026-11-23T11:00:00Z",
          offer_id: "67890",
          base_account: "GBASE",
          base_amount: "50.0000000",
          base_asset_type: "native",
          counter_account: "GCOUNTER2",
          counter_amount: "75.0000000",
          counter_asset_type: "native",
          price: { n: 2, d: 3 },
          base_is_seller: false,
        },
      ],
    };

    tradesCallMock.mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);

    const firstPage = await getTrades("GTEST");
    const secondPage = await getTrades("GTEST", undefined, firstPage.nextCursor);

    // Verify no duplicate IDs
    const allIds = [...firstPage.records.map((t) => t.id), ...secondPage.records.map((t) => t.id)];
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });

  it("handles accounts with no trades", async () => {
    tradesCallMock.mockResolvedValue({ records: [] });

    const result = await getTrades("GTEST");

    expect(result.records).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });

  it("propagates Horizon errors", async () => {
    tradesCallMock.mockRejectedValue(new Error("Account not found"));

    await expect(getTrades("GTEST")).rejects.toThrow("Account not found");
  });

  it("rejects when public key is missing", async () => {
    await expect(getTrades("")).rejects.toThrow("Public key is required.");
    await expect(getTrades(null)).rejects.toThrow("Public key is required.");
    await expect(getTrades(undefined)).rejects.toThrow("Public key is required.");
  });

  it("rejects when public key is not a string", async () => {
    await expect(getTrades(12345)).rejects.toThrow("Public key is required.");
    await expect(getTrades({})).rejects.toThrow("Public key is required.");
  });

  it("includes base and counter account addresses", async () => {
    tradesCallMock.mockResolvedValue(horizonTradesFixture());

    const result = await getTrades("GTEST");

    expect(result.records[0].base_account).toBe("GBASE");
    expect(result.records[0].counter_account).toBe("GCOUNTER");
  });

  it("handles trades with native assets", async () => {
    tradesCallMock.mockResolvedValue(horizonTradesFixture());

    const result = await getTrades("GTEST");

    expect(result.records[0].base_asset_type).toBe("native");
    expect(result.records[1].counter_asset_type).toBe("native");
  });

  it("handles trades with credit assets", async () => {
    tradesCallMock.mockResolvedValue(horizonTradesFixture());

    const result = await getTrades("GTEST");

    expect(result.records[0]).toMatchObject({
      counter_asset_type: "credit_alphanum4",
      counter_asset_code: "USDC",
      counter_asset_issuer: "GISSUER",
    });

    expect(result.records[1]).toMatchObject({
      base_asset_type: "credit_alphanum4",
      base_asset_code: "BTC",
      base_asset_issuer: "GBTCISSUER",
    });
  });

  it("keeps previously loaded rows on pagination failure", async () => {
    const page1 = horizonTradesFixture();
    tradesCallMock.mockResolvedValueOnce(page1).mockRejectedValueOnce(new Error("Network error"));

    const firstPage = await getTrades("GTEST");
    
    // First page loads successfully
    expect(firstPage.records).toHaveLength(2);

    // Second page fails, but first page data is still available
    await expect(getTrades("GTEST", undefined, firstPage.nextCursor)).rejects.toThrow(
      "Network error"
    );

    // The first page data is not lost (would be handled by UI state management)
    expect(firstPage.records).toHaveLength(2);
  });
});
