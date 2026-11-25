import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({
  fetchAccountViaApi: vi.fn(),
  fetchPaymentsViaApi: vi.fn(),
}));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: vi.fn(function () {
        return {};
      }),
    },
  };
});

const {
  getPendingTransactions,
  selectPendingTransactions,
  statusWatchHref,
} = await import("./stellar");

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pending Horizon transactions", () => {
  it("renders two pending hashes and ignores an applied one", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        _embedded: {
          records: [
            {
              hash: "aaa111pendinghash0000000000000000000000000000000000000001",
              fee: "100",
              sequence: "10",
              status: "pending",
            },
            {
              hash: "bbb222appliedhash0000000000000000000000000000000000000002",
              fee_charged: "200",
              source_account_sequence: "11",
              status: "applied",
            },
            {
              hash: "ccc333pendinghash0000000000000000000000000000000000000003",
              max_fee: "150",
              sequence: "12",
              tx_status: "PENDING",
            },
          ],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const rows = await getPendingTransactions("GTESTACCOUNT");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://horizon-testnet.stellar.org/accounts/GTESTACCOUNT/pending_transactions"
    );
    expect(rows.map((row) => row.hash)).toEqual([
      "aaa111pendinghash0000000000000000000000000000000000000001",
      "ccc333pendinghash0000000000000000000000000000000000000003",
    ]);
    expect(rows).toEqual([
      {
        hash: "aaa111pendinghash0000000000000000000000000000000000000001",
        fee: "100",
        sequence: "10",
        status: "pending",
      },
      {
        hash: "ccc333pendinghash0000000000000000000000000000000000000003",
        fee: "150",
        sequence: "12",
        status: "pending",
      },
    ]);
  });

  it("treats a 404 from the pending endpoint as an empty list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ status: 404 }),
      })
    );

    await expect(getPendingTransactions("GTESTACCOUNT")).resolves.toEqual([]);
  });

  it("drops applied rows when selecting for the panel", () => {
    expect(
      selectPendingTransactions([
        { hash: "pending-a", fee: "1", sequence: "1", status: "pending" },
        { hash: "applied-b", fee: "2", sequence: "2", status: "applied" },
        { hash: "pending-c", fee: "3", sequence: "3", status: "PENDING" },
      ]).map((row) => row.hash)
    ).toEqual(["pending-a", "pending-c"]);
  });

  it("links each hash to the status watch", () => {
    expect(statusWatchHref("deadbeef")).toBe("#status-watch/deadbeef");
  });
});
