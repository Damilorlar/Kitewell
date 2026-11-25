import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({
  fetchAccountViaApi: vi.fn(),
  fetchPaymentsViaApi: vi.fn(),
}));

const {
  forAccountMock,
  limitMock,
  orderMock,
  paymentsCallMock,
} = vi.hoisted(() => {
  const paymentsCallMock = vi.fn();
  const orderMock = vi.fn(() => ({ join: () => ({ call: paymentsCallMock }) }));
  const limitMock = vi.fn(() => ({ order: orderMock }));
  const forAccountMock = vi.fn(() => ({ limit: limitMock }));

  return { forAccountMock, limitMock, orderMock, paymentsCallMock };
});

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: vi.fn(function () {
        return {
          payments: () => ({ forAccount: forAccountMock }),
        };
      }),
    },
  };
});

const { fetchPaymentsViaApi } = await import("./api");
const { getTransactions } = await import("./stellar");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getTransactions Horizon query", () => {
  it("passes the account, limit, and descending order to Horizon on API failure", async () => {
    fetchPaymentsViaApi.mockRejectedValue(new Error("backend down"));
    paymentsCallMock.mockResolvedValue({ records: [] });

    await expect(getTransactions("GTEST", 4)).resolves.toEqual({
      records: [],
      nextCursor: null,
    });

    expect(forAccountMock).toHaveBeenCalledWith("GTEST");
    expect(limitMock).toHaveBeenCalledWith(4);
    expect(orderMock).toHaveBeenCalledWith("desc");
  });
});