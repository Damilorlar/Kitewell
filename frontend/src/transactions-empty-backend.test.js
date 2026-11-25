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

const { fetchPaymentsViaApi } = await import("./api");
const { getTransactions } = await import("./stellar");

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockReset();
  paymentsCallMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("empty backend transaction history", () => {
  it("returns an empty page without querying Horizon", async () => {
    const page = { records: [], nextCursor: null };
    fetchPaymentsViaApi.mockResolvedValue(page);

    await expect(getTransactions("GTEST")).resolves.toEqual(page);
    expect(fetchPaymentsViaApi).toHaveBeenCalledWith(
      "GTEST",
      15,
      undefined,
      "TESTNET"
    );
    expect(paymentsCallMock).not.toHaveBeenCalled();
  });
});