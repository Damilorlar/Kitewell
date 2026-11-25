import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({
  fetchAccountViaApi: vi.fn(),
  fetchPaymentsViaApi: vi.fn(),
}));

const { joinMock, paymentsCallMock } = vi.hoisted(() => {
  const paymentsCallMock = vi.fn();
  const joinMock = vi.fn(() => ({ call: paymentsCallMock }));
  return { joinMock, paymentsCallMock };
});

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
              limit: () => ({ order: () => ({ join: joinMock }) }),
            }),
          }),
        };
      }),
    },
  };
});

const { fetchPaymentsViaApi } = await import("./api");
const { getTransactions } = await import("./stellar");
const { formatHistoryFee } = await import("./historyFee");

function payment(id, transaction) {
  return {
    type: "payment",
    id,
    from: "GALICE",
    to: "GTEST",
    amount: "1.0000000",
    asset_type: "native",
    transaction_hash: `hash-${id}`,
    created_at: "2026-01-01T00:00:00Z",
    transaction,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchPaymentsViaApi.mockRejectedValue(new Error("backend down"));
});

describe("getTransactions fee and operation count", () => {
  it("asks Horizon to embed the transaction record", async () => {
    paymentsCallMock.mockResolvedValue({ records: [] });
    await getTransactions("GTEST");
    expect(joinMock).toHaveBeenCalledWith("transactions");
  });

  it("formats a one-operation payment and a fee-bumped transaction from the records", async () => {
    paymentsCallMock.mockResolvedValue({
      records: [
        payment("p1", { fee_charged: "100", max_fee: "1000", operation_count: 1 }),
        payment("p2", {
          fee_charged: "400",
          operation_count: 1,
          fee_bump_transaction: { hash: "outer" },
          inner_transaction: { hash: "inner", max_fee: "100" },
        }),
        payment("p3", undefined),
      ],
    });

    const { records } = await getTransactions("GTEST");

    expect(records.map(formatHistoryFee)).toEqual([
      "Fee 0.00001 XLM · 1 operation",
      "Fee 0.00004 XLM · fee-bumped · 1 operation",
      "Fee unknown · operations unknown",
    ]);
  });
});
