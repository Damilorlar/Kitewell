import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("getTransactions API limit", () => {
  it("forwards a custom limit to the payments API and returns its page", async () => {
    const page = { records: [{ id: "p1" }], nextCursor: null };
    fetchPaymentsViaApi.mockResolvedValue(page);

    await expect(getTransactions("GTEST", 7)).resolves.toBe(page);
    expect(fetchPaymentsViaApi).toHaveBeenCalledWith(
      "GTEST",
      7,
      undefined,
      "TESTNET"
    );
  });
});
