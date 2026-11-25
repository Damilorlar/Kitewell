import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
                order: () => ({ join: () => ({ call: paymentsCallMock }) }),
              }),
            }),
          }),
        };
      }),
    },
  };
});

const { fetchAccountViaApi } = await import("./api");
const { setActiveNetwork } = await import("./network");
const { getAccountBalances } = await import("./stellar");

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockReset();
  paymentsCallMock.mockReset();
});

afterEach(() => {
  setActiveNetwork("TESTNET");
  vi.unstubAllGlobals();
});

describe("Futurenet account balances", () => {
  it("reads Futurenet balances from the backend", async () => {
    setActiveNetwork("FUTURENET");
    fetchAccountViaApi.mockResolvedValue({
      balances: [{ key: "native", code: "XLM", balance: "9.0000000", isNative: true }],
    });

    await expect(getAccountBalances("GTEST")).resolves.toEqual([
      { key: "native", code: "XLM", balance: "9.0000000", isNative: true },
    ]);
    expect(fetchAccountViaApi).toHaveBeenCalledWith("GTEST", "FUTURENET");
    expect(loadAccountMock).not.toHaveBeenCalled();
  });

  it("falls back to Futurenet Horizon only when the backend is unreachable", async () => {
    setActiveNetwork("FUTURENET");
    fetchAccountViaApi.mockRejectedValue(new Error("backend down"));
    loadAccountMock.mockResolvedValue({
      balances: [{ asset_type: "native", balance: "3.5000000" }],
      subentry_count: 0,
    });

    await expect(getAccountBalances("GTEST")).resolves.toEqual([
      {
        key: "native",
        code: "XLM",
        issuer: null,
        balance: "3.5000000",
        limit: null,
        isNative: true,
        sellingLiabilities: "0",
        buyingLiabilities: "0",
      },
    ]);
    expect(loadAccountMock).toHaveBeenCalledWith("GTEST");
  });
});
