import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({
  fetchAccountViaApi: vi.fn(),
  fetchPaymentsViaApi: vi.fn(),
}));

const { paymentsCallMock } = vi.hoisted(() => ({
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
  paymentsCallMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Horizon transaction asset mapping", () => {
  it("preserves a credit asset code from the fallback record", async () => {
    fetchPaymentsViaApi.mockRejectedValue(new Error("backend down"));
    paymentsCallMock.mockResolvedValue({
      records: [
        {
          type: "payment",
          id: "p1",
          from: "GALICE",
          to: "GTEST",
          amount: "1.0000000",
          asset_type: "credit_alphanum4",
          asset_code: "USDC",
          asset_issuer: "GISSUER",
          transaction_hash: "h1",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    });

    await expect(getTransactions("GTEST")).resolves.toEqual({
      records: [
        {
          id: "p1",
          from: "GALICE",
          to: "GTEST",
          amount: "1.0000000",
          asset_type: "credit_alphanum4",
          asset_code: "USDC",
          transaction_hash: "h1",
          created_at: "2026-01-01T00:00:00Z",
          fee_charged: null,
          operation_count: null,
          fee_bumped: false,
        },
      ],
      nextCursor: null,
    });
    expect(paymentsCallMock).toHaveBeenCalledTimes(1);
  });
});