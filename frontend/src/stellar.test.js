import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CI-friendly test suite for the Kitewell stellar helpers.
 *
 * Nothing here touches the network or a Freighter wallet:
 * - `./api` is mocked so the "backend-backed" paths are simulated.
 * - The Horizon `Server` is mocked so the "Horizon fallback" paths are simulated.
 * - `globalThis.fetch` is stubbed for Friendbot funding.
 */

vi.mock("./api", () => ({
  fetchAccountViaApi: vi.fn(),
  fetchPaymentsViaApi: vi.fn(),
}));

const { loadAccountMock, paymentsCallMock } = vi.hoisted(() => ({
  loadAccountMock: vi.fn(),
  paymentsCallMock: vi.fn(),
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
          payments: () => ({
            forAccount: () => ({
              limit: () => ({
                order: () => ({ call: paymentsCallMock }),
              }),
            }),
          }),
        };
      }),
    },
  };
});

const { fetchAccountViaApi, fetchPaymentsViaApi } = await import("./api");
const {
  explorerAccountUrl,
  explorerTxUrl,
  fundWithFriendbot,
  getAccountBalances,
  getAccountDetails,
  getBalance,
  getTransactions,
} = await import("./stellar");

/** Minimal Horizon account payload: 3.5 XLM + an issued asset. */
function horizonAccountFixture() {
  return {
    id: "GTEST",
    sequenceNumber: () => "123",
    subentry_count: 2,
    thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
    balances: [
      {
        asset_type: "native",
        balance: "3.5000000",
      },
      {
        asset_type: "credit_alphanum4",
        asset_code: "FOO",
        asset_issuer: "GISSUER",
        balance: "11.0000000",
        limit: "1000.0000000",
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockReset();
  paymentsCallMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("explorer urls", () => {
  it("builds account and tx explorer urls on the testnet base", () => {
    expect(explorerAccountUrl("GTEST")).toBe(
      "https://stellar.expert/explorer/testnet/account/GTEST"
    );
    expect(explorerTxUrl("hash123")).toBe(
      "https://stellar.expert/explorer/testnet/tx/hash123"
    );
  });
});

describe("fundWithFriendbot", () => {
  it("returns the friendbot JSON on success", async () => {
    const body = { hash: "abc123", successful: true };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => body })
    );

    await expect(fundWithFriendbot("GTEST")).resolves.toEqual(body);
    expect(fetch).toHaveBeenCalledWith(
      "https://friendbot.stellar.org?addr=GTEST"
    );
  });

  it("maps friendbot failures to a friendly error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve("oops"),
      })
    );

    await expect(fundWithFriendbot("GTEST")).rejects.toThrow(
      "Account may already be funded. Refresh balances instead."
    );
  });
});

describe("getBalance", () => {
  it("returns the native XLM balance", async () => {
    fetchAccountViaApi.mockResolvedValue({
      balances: [
        { key: "FOO:GISSUER", code: "FOO", balance: "11.0000000", isNative: false },
        { key: "native", code: "XLM", balance: "3.5000000", isNative: true },
      ],
    });

    await expect(getBalance("GTEST")).resolves.toBe("3.5000000");
    expect(fetchAccountViaApi).toHaveBeenCalledWith("GTEST");
  });

  it("falls back to Horizon and reports 0 when no native balance exists", async () => {
    fetchAccountViaApi.mockRejectedValue(new Error("backend down"));
    loadAccountMock.mockResolvedValue({
      balances: [
        {
          asset_type: "credit_alphanum4",
          asset_code: "FOO",
          asset_issuer: "GISSUER",
          balance: "1.0000000",
          limit: "10.0000000",
        },
      ],
    });

    await expect(getBalance("GTEST")).resolves.toBe("0");
    expect(loadAccountMock).toHaveBeenCalledWith("GTEST");
  });
});

describe("balance mapping", () => {
  it("passes through backend-mapped balances untouched", async () => {
    fetchAccountViaApi.mockResolvedValue({
      balances: [
        { key: "native", code: "XLM", issuer: null, balance: "3.5000000", limit: null, isNative: true },
        {
          key: "FOO:GISSUER",
          code: "FOO",
          issuer: "GISSUER",
          balance: "11.0000000",
          limit: "1000.0000000",
          isNative: false,
        },
      ],
    });

    await expect(getAccountBalances("GTEST")).resolves.toEqual([
      { key: "native", code: "XLM", issuer: null, balance: "3.5000000", limit: null, isNative: true },
      {
        key: "FOO:GISSUER",
        code: "FOO",
        issuer: "GISSUER",
        balance: "11.0000000",
        limit: "1000.0000000",
        isNative: false,
      },
    ]);
  });

  it("normalizes raw Horizon balances on the fallback path", async () => {
    fetchAccountViaApi.mockRejectedValue(new Error("backend down"));
    loadAccountMock.mockResolvedValue(horizonAccountFixture());

    await expect(getAccountBalances("GTEST")).resolves.toEqual([
      { key: "native", code: "XLM", issuer: null, balance: "3.5000000", limit: null, isNative: true },
      {
        key: "FOO:GISSUER",
        code: "FOO",
        issuer: "GISSUER",
        balance: "11.0000000",
        limit: "1000.0000000",
        isNative: false,
      },
    ]);
  });

  it("enriches account details with explorer url on the fallback path", async () => {
    fetchAccountViaApi.mockRejectedValue(new Error("backend down"));
    loadAccountMock.mockResolvedValue(horizonAccountFixture());

    const details = await getAccountDetails("GTEST");
    expect(details).toMatchObject({
      id: "GTEST",
      sequence: "123",
      subentryCount: 2,
      balances: expect.arrayContaining([
        expect.objectContaining({ code: "XLM", isNative: true }),
        expect.objectContaining({ code: "FOO", isNative: false }),
      ]),
      explorerUrl: "https://stellar.expert/explorer/testnet/account/GTEST",
    });
  });
});

describe("getTransactions", () => {
  it("returns backend payment records when the API works", async () => {
    const records = [
      {
        id: "p1",
        from: "GALICE",
        to: "GTEST",
        amount: "1.0000000",
        asset_type: "native",
        asset_code: "XLM",
        transaction_hash: "h1",
        created_at: "2026-01-01T00:00:00Z",
      },
    ];
    fetchPaymentsViaApi.mockResolvedValue(records);

    await expect(getTransactions("GTEST")).resolves.toEqual(records);
    expect(fetchPaymentsViaApi).toHaveBeenCalledWith("GTEST", 15);
  });

  it("filters to payments and defaults non-native asset codes to XLM on fallback", async () => {
    fetchPaymentsViaApi.mockRejectedValue(new Error("backend down"));
    paymentsCallMock.mockResolvedValue({
      records: [
        {
          type: "payment",
          id: "p1",
          from: "GALICE",
          to: "GTEST",
          amount: "1.0000000",
          asset_type: "native",
          transaction_hash: "h1",
          created_at: "2026-01-01T00:00:00Z",
        },
        { type: "create_account", id: "skip-me" },
      ],
    });

    await expect(getTransactions("GTEST")).resolves.toEqual([
      {
        id: "p1",
        from: "GALICE",
        to: "GTEST",
        amount: "1.0000000",
        asset_type: "native",
        asset_code: "XLM",
        transaction_hash: "h1",
        created_at: "2026-01-01T00:00:00Z",
      },
    ]);
    expect(paymentsCallMock).toHaveBeenCalledTimes(1);
  });
});
