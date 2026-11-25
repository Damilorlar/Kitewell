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
const { getAccountDetails } = await import("./stellar");

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockReset();
  paymentsCallMock.mockReset();
});

afterEach(() => {
  setActiveNetwork("TESTNET");
  vi.unstubAllGlobals();
});

describe("Futurenet account details", () => {
  it("asks the backend for Futurenet details", async () => {
    setActiveNetwork("FUTURENET");
    const payload = { id: "GTEST", explorerUrl: "futurenet" };
    fetchAccountViaApi.mockResolvedValue(payload);

    await expect(getAccountDetails("GTEST")).resolves.toBe(payload);
    expect(fetchAccountViaApi).toHaveBeenCalledWith("GTEST", "FUTURENET");
    expect(loadAccountMock).not.toHaveBeenCalled();
  });

  it("falls back to Futurenet Horizon with a Futurenet explorer URL", async () => {
    setActiveNetwork("FUTURENET");
    fetchAccountViaApi.mockRejectedValue(new Error("backend down"));
    loadAccountMock.mockResolvedValue({
      id: "GTEST",
      sequenceNumber: () => "123",
      subentry_count: 2,
      thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
      balances: [{ asset_type: "native", balance: "3.5000000" }],
    });

    const details = await getAccountDetails("GTEST");

    expect(details).toMatchObject({
      id: "GTEST",
      sequence: "123",
      subentryCount: 2,
      explorerUrl: "https://stellar.expert/explorer/futurenet/account/GTEST",
    });
    expect(loadAccountMock).toHaveBeenCalledWith("GTEST");
  });
});
