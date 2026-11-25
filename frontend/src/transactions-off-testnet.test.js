import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Issue #492: payment history now asks the backend for the selected network
 * and only reads Horizon directly when the backend is unreachable.
 */

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
const { setActiveNetwork } = await import("./network");
const { getTransactions } = await import("./stellar");

afterEach(() => {
  setActiveNetwork("TESTNET");
  vi.clearAllMocks();
});

describe("getTransactions off Testnet", () => {
  it("asks the backend for Futurenet history", async () => {
    setActiveNetwork("FUTURENET");
    const page = { records: [{ id: "1" }], nextCursor: "cursor-1" };
    fetchPaymentsViaApi.mockResolvedValue(page);

    await expect(getTransactions("GTEST")).resolves.toBe(page);

    expect(fetchPaymentsViaApi).toHaveBeenCalledWith(
      "GTEST",
      15,
      undefined,
      "FUTURENET"
    );
    expect(paymentsCallMock).not.toHaveBeenCalled();
  });

  it("falls back to Futurenet Horizon when the backend is unreachable", async () => {
    setActiveNetwork("FUTURENET");
    fetchPaymentsViaApi.mockRejectedValue(new Error("backend down"));
    paymentsCallMock.mockResolvedValue({
      records: [
        {
          id: "1",
          type: "payment",
          from: "GFROM",
          to: "GTO",
          amount: "10.0000000",
          asset_type: "native",
          transaction_hash: "abc",
          created_at: "2024-01-01T00:00:00Z",
        },
      ],
    });

    const { records, nextCursor } = await getTransactions("GTEST");

    expect(paymentsCallMock).toHaveBeenCalledTimes(1);
    expect(records).toHaveLength(1);
    expect(records[0].transaction_hash).toBe("abc");
    expect(nextCursor).toBeNull();
  });
});
