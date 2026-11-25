import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CI-friendly tests for reading Horizon `/fee_stats`. The Horizon Server is
 * mocked, so no network access is required.
 */

const { feeStatsMock } = vi.hoisted(() => ({
  feeStatsMock: vi.fn(),
}));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: vi.fn(function () {
        return { feeStats: feeStatsMock };
      }),
    },
  };
});

vi.mock("./api", () => ({
  fetchAccountViaApi: vi.fn(),
  fetchPaymentsViaApi: vi.fn(),
}));

const { getFeeStats } = await import("./stellar");

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getFeeStats", () => {
  it("returns the last ledger's mode, p10, and p99", async () => {
    feeStatsMock.mockResolvedValue({
      last_ledger: "12345",
      last_ledger_base_fee: "100",
      fee_charged: {
        min: "100",
        mode: "250",
        p10: "120",
        p99: "9000",
      },
    });

    await expect(getFeeStats()).resolves.toEqual({
      mode: "250",
      p10: "120",
      p99: "9000",
      lastLedger: "12345",
    });
  });

  it("falls back to the base fee when a percentile is missing", async () => {
    feeStatsMock.mockResolvedValue({
      last_ledger_base_fee: "100",
      fee_charged: { mode: "200" },
    });

    await expect(getFeeStats()).resolves.toEqual({
      mode: "200",
      p10: "100",
      p99: "100",
      lastLedger: null,
    });
  });

  it("rejects when Horizon cannot be reached", async () => {
    feeStatsMock.mockRejectedValue(new Error("Horizon down"));

    await expect(getFeeStats()).rejects.toThrow("Horizon down");
  });
});
