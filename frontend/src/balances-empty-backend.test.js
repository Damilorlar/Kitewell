import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({
  fetchAccountViaApi: vi.fn(),
}));

const { loadAccountMock } = vi.hoisted(() => ({
  loadAccountMock: vi.fn(),
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
        };
      }),
    },
  };
});

const { fetchAccountViaApi } = await import("./api");
const { getAccountBalances } = await import("./stellar");

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockReset();
});

describe("getAccountBalances with an empty backend response", () => {
  it("returns the empty list without falling back to Horizon", async () => {
    fetchAccountViaApi.mockResolvedValue({ balances: [] });

    await expect(getAccountBalances("GTEST")).resolves.toEqual([]);
    expect(loadAccountMock).not.toHaveBeenCalled();
  });
});