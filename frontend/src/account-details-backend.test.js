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

const { fetchAccountViaApi } = await import("./api");
const { getAccountDetails } = await import("./stellar");

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockReset();
  paymentsCallMock.mockReset();
});

describe("getAccountDetails backend success", () => {
  it("returns the backend payload unchanged without calling Horizon", async () => {
    const payload = { id: "GTEST", sequence: "9", custom: true };
    fetchAccountViaApi.mockResolvedValue(payload);

    await expect(getAccountDetails("GTEST")).resolves.toBe(payload);
    expect(fetchAccountViaApi).toHaveBeenCalledWith("GTEST", "TESTNET");
    expect(loadAccountMock).not.toHaveBeenCalled();
  });
});
