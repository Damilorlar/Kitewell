import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Test suite for account snapshot download functionality.
 *
 * Tests the getAccountSnapshot and downloadAccountSnapshot functions that
 * create a comprehensive JSON export of an account from Horizon.
 */

const { loadAccountMock, offersCallMock } = vi.hoisted(() => ({
  loadAccountMock: vi.fn(),
  offersCallMock: vi.fn(),
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
          offers: () => ({
            forAccount: () => ({
              limit: () => ({ call: offersCallMock }),
            }),
          }),
        };
      }),
    },
  };
});

const { getAccountSnapshot, downloadAccountSnapshot } = await import("./stellar");

/** Minimal Horizon account fixture with various features */
function horizonAccountFixture() {
  return {
    id: "GTEST1234567890",
    sequenceNumber: () => "98765432109876",
    subentry_count: 5,
    thresholds: { low_threshold: 1, med_threshold: 2, high_threshold: 3 },
    signers: [
      { key: "GTEST1234567890", weight: 10, type: "ed25519_public_key" },
      { key: "GSIGNER234567890", weight: 5, type: "ed25519_public_key" },
    ],
    balances: [
      {
        asset_type: "native",
        balance: "150.5000000",
      },
      {
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
        asset_issuer: "GISSUER",
        balance: "1000.0000000",
        limit: "5000.0000000",
      },
      {
        asset_type: "liquidity_pool_shares",
        liquidity_pool_id: "abc123pool",
        balance: "50.0000000",
      },
    ],
    data_attr: {
      greeting: Buffer.from("Hello World", "utf8").toString("base64"),
      binary: Buffer.from([0xff, 0xfe, 0xfd]).toString("base64"),
    },
  };
}

/** Minimal Horizon offers fixture */
function horizonOffersFixture() {
  return {
    records: [
      {
        id: "12345",
        selling: { asset_type: "native" },
        buying: { asset_type: "credit_alphanum4", asset_code: "USDC", asset_issuer: "GISSUER" },
        amount: "100.0000000",
        price: "1.5000000",
        price_r: { n: 3, d: 2 },
      },
      {
        id: "67890",
        selling: { asset_type: "credit_alphanum4", asset_code: "USDC", asset_issuer: "GISSUER" },
        buying: { asset_type: "native" },
        amount: "50.0000000",
        price: "0.6666667",
        price_r: { n: 2, d: 3 },
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockReset();
  offersCallMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getAccountSnapshot", () => {
  it("fetches complete account data from Horizon", async () => {
    loadAccountMock.mockResolvedValue(horizonAccountFixture());
    offersCallMock.mockResolvedValue(horizonOffersFixture());

    const snapshot = await getAccountSnapshot("GTEST1234567890");

    expect(snapshot.id).toBe("GTEST1234567890");
    expect(snapshot.sequence).toBe("98765432109876");
    expect(snapshot.subentryCount).toBe(5);
    expect(loadAccountMock).toHaveBeenCalledWith("GTEST1234567890");
  });

  it("includes account id and sequence", async () => {
    loadAccountMock.mockResolvedValue(horizonAccountFixture());
    offersCallMock.mockResolvedValue({ records: [] });

    const snapshot = await getAccountSnapshot("GTEST1234567890");

    expect(snapshot).toHaveProperty("id", "GTEST1234567890");
    expect(snapshot).toHaveProperty("sequence", "98765432109876");
  });

  it("includes balances for all asset types", async () => {
    loadAccountMock.mockResolvedValue(horizonAccountFixture());
    offersCallMock.mockResolvedValue({ records: [] });

    const snapshot = await getAccountSnapshot("GTEST1234567890");

    expect(snapshot.balances).toHaveLength(3);
    expect(snapshot.balances[0]).toMatchObject({
      key: "native",
      code: "XLM",
      isNative: true,
      balance: "150.5000000",
    });
    expect(snapshot.balances[1]).toMatchObject({
      key: "USDC:GISSUER",
      code: "USDC",
      issuer: "GISSUER",
      isNative: false,
      balance: "1000.0000000",
      limit: "5000.0000000",
    });
    expect(snapshot.balances[2]).toMatchObject({
      key: "pool:abc123pool",
      code: "POOL",
      isPoolShare: true,
      poolId: "abc123pool",
    });
  });

  it("includes signers with key, weight, and type", async () => {
    loadAccountMock.mockResolvedValue(horizonAccountFixture());
    offersCallMock.mockResolvedValue({ records: [] });

    const snapshot = await getAccountSnapshot("GTEST1234567890");

    expect(snapshot.signers).toHaveLength(2);
    expect(snapshot.signers[0]).toEqual({
      key: "GTEST1234567890",
      weight: 10,
      type: "ed25519_public_key",
    });
    expect(snapshot.signers[1]).toEqual({
      key: "GSIGNER234567890",
      weight: 5,
      type: "ed25519_public_key",
    });
  });

  it("includes thresholds", async () => {
    loadAccountMock.mockResolvedValue(horizonAccountFixture());
    offersCallMock.mockResolvedValue({ records: [] });

    const snapshot = await getAccountSnapshot("GTEST1234567890");

    expect(snapshot.thresholds).toEqual({
      low: 1,
      medium: 2,
      high: 3,
    });
  });

  it("includes data entries with UTF-8 values as strings", async () => {
    loadAccountMock.mockResolvedValue(horizonAccountFixture());
    offersCallMock.mockResolvedValue({ records: [] });

    const snapshot = await getAccountSnapshot("GTEST1234567890");

    expect(snapshot.data).toHaveProperty("greeting", "Hello World");
  });

  it("converts non-UTF-8 data values to hex", async () => {
    loadAccountMock.mockResolvedValue(horizonAccountFixture());
    offersCallMock.mockResolvedValue({ records: [] });

    const snapshot = await getAccountSnapshot("GTEST1234567890");

    expect(snapshot.data).toHaveProperty("binary");
    expect(snapshot.data.binary).toMatch(/^[0-9a-f]+$/);
  });

  it("includes offers with id, selling, buying, amount, and price", async () => {
    loadAccountMock.mockResolvedValue(horizonAccountFixture());
    offersCallMock.mockResolvedValue(horizonOffersFixture());

    const snapshot = await getAccountSnapshot("GTEST1234567890");

    expect(snapshot.offers).toHaveLength(2);
    expect(snapshot.offers[0]).toMatchObject({
      id: "12345",
      selling: { asset_type: "native" },
      buying: { asset_type: "credit_alphanum4", asset_code: "USDC", asset_issuer: "GISSUER" },
      amount: "100.0000000",
      price: "1.5000000",
      price_r: { n: 3, d: 2 },
    });
  });

  it("includes subentry count", async () => {
    loadAccountMock.mockResolvedValue(horizonAccountFixture());
    offersCallMock.mockResolvedValue({ records: [] });

    const snapshot = await getAccountSnapshot("GTEST1234567890");

    expect(snapshot).toHaveProperty("subentryCount", 5);
  });

  it("includes network identifier", async () => {
    loadAccountMock.mockResolvedValue(horizonAccountFixture());
    offersCallMock.mockResolvedValue({ records: [] });

    const snapshot = await getAccountSnapshot("GTEST1234567890");

    expect(snapshot).toHaveProperty("network");
    expect(snapshot.network).toBe("TESTNET");
  });

  it("includes export timestamp", async () => {
    loadAccountMock.mockResolvedValue(horizonAccountFixture());
    offersCallMock.mockResolvedValue({ records: [] });

    const snapshot = await getAccountSnapshot("GTEST1234567890");

    expect(snapshot).toHaveProperty("exportedAt");
    expect(new Date(snapshot.exportedAt).getTime()).toBeGreaterThan(0);
  });

  it("does not include secrets", async () => {
    loadAccountMock.mockResolvedValue(horizonAccountFixture());
    offersCallMock.mockResolvedValue({ records: [] });

    const snapshot = await getAccountSnapshot("GTEST1234567890");
    const json = JSON.stringify(snapshot);

    expect(json).not.toContain("secret");
    expect(json).not.toContain("private");
    expect(json).not.toContain("seed");
    expect(snapshot).not.toHaveProperty("secretKey");
    expect(snapshot).not.toHaveProperty("privateKey");
  });

  it("does not include signed XDR", async () => {
    loadAccountMock.mockResolvedValue(horizonAccountFixture());
    offersCallMock.mockResolvedValue({ records: [] });

    const snapshot = await getAccountSnapshot("GTEST1234567890");

    expect(snapshot).not.toHaveProperty("xdr");
    expect(snapshot).not.toHaveProperty("signedXdr");
    expect(snapshot).not.toHaveProperty("envelope");
  });

  it("handles accounts with no data entries", async () => {
    const account = horizonAccountFixture();
    delete account.data_attr;
    loadAccountMock.mockResolvedValue(account);
    offersCallMock.mockResolvedValue({ records: [] });

    const snapshot = await getAccountSnapshot("GTEST1234567890");

    expect(snapshot.data).toEqual({});
  });

  it("handles accounts with no offers", async () => {
    loadAccountMock.mockResolvedValue(horizonAccountFixture());
    offersCallMock.mockResolvedValue({ records: [] });

    const snapshot = await getAccountSnapshot("GTEST1234567890");

    expect(snapshot.offers).toEqual([]);
  });

  it("continues when offers fetch fails", async () => {
    loadAccountMock.mockResolvedValue(horizonAccountFixture());
    offersCallMock.mockRejectedValue(new Error("Offers unavailable"));

    const snapshot = await getAccountSnapshot("GTEST1234567890");

    expect(snapshot.offers).toEqual([]);
    expect(snapshot.id).toBe("GTEST1234567890");
  });

  it("rejects when Horizon loadAccount fails", async () => {
    loadAccountMock.mockRejectedValue(new Error("Account not found"));

    await expect(getAccountSnapshot("GTEST1234567890")).rejects.toThrow(
      "Account not found"
    );
  });

  it("rejects when public key is missing", async () => {
    await expect(getAccountSnapshot("")).rejects.toThrow(
      "Public key is required."
    );
    await expect(getAccountSnapshot(null)).rejects.toThrow(
      "Public key is required."
    );
    await expect(getAccountSnapshot(undefined)).rejects.toThrow(
      "Public key is required."
    );
  });

  it("rejects when public key is not a string", async () => {
    await expect(getAccountSnapshot(12345)).rejects.toThrow(
      "Public key is required."
    );
    await expect(getAccountSnapshot({})).rejects.toThrow(
      "Public key is required."
    );
  });

  it("uses the selected network's Horizon", async () => {
    loadAccountMock.mockResolvedValue(horizonAccountFixture());
    offersCallMock.mockResolvedValue({ records: [] });

    const snapshot = await getAccountSnapshot("GTEST1234567890");

    // Network should match the active network (TESTNET by default in tests)
    expect(snapshot.network).toBe("TESTNET");
  });

  it("includes all required fields in one snapshot", async () => {
    loadAccountMock.mockResolvedValue(horizonAccountFixture());
    offersCallMock.mockResolvedValue(horizonOffersFixture());

    const snapshot = await getAccountSnapshot("GTEST1234567890");

    // Check that all required fields are present
    expect(snapshot).toHaveProperty("id");
    expect(snapshot).toHaveProperty("sequence");
    expect(snapshot).toHaveProperty("balances");
    expect(snapshot).toHaveProperty("signers");
    expect(snapshot).toHaveProperty("thresholds");
    expect(snapshot).toHaveProperty("data");
    expect(snapshot).toHaveProperty("offers");
    expect(snapshot).toHaveProperty("subentryCount");
    expect(snapshot).toHaveProperty("network");
    expect(snapshot).toHaveProperty("exportedAt");
  });
});

describe("downloadAccountSnapshot", () => {
  beforeEach(() => {
    // Mock DOM APIs for download tests
    globalThis.document = {
      createElement: vi.fn((tag) => ({
        href: "",
        download: "",
        click: vi.fn(),
      })),
    };
    globalThis.URL = {
      createObjectURL: vi.fn(() => "blob:mock-url"),
      revokeObjectURL: vi.fn(),
    };
    globalThis.Blob = class MockBlob {
      constructor(parts, options) {
        this.parts = parts;
        this.type = options?.type;
      }
    };
  });

  afterEach(() => {
    delete globalThis.document;
    delete globalThis.Blob;
  });

  it("creates a downloadable JSON file", async () => {
    loadAccountMock.mockResolvedValue(horizonAccountFixture());
    offersCallMock.mockResolvedValue({ records: [] });

    await downloadAccountSnapshot("GTEST1234567890");

    expect(globalThis.document.createElement).toHaveBeenCalledWith("a");
    expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("generates filename with account prefix and timestamp", async () => {
    loadAccountMock.mockResolvedValue(horizonAccountFixture());
    offersCallMock.mockResolvedValue({ records: [] });

    const mockLink = { href: "", download: "", click: vi.fn() };
    globalThis.document.createElement.mockReturnValue(mockLink);

    await downloadAccountSnapshot("GTEST1234567890");

    expect(mockLink.download).toMatch(/^kitewell-account-GTEST123-\d+\.json$/);
  });

  it("propagates Horizon errors", async () => {
    loadAccountMock.mockRejectedValue(new Error("Account not found"));

    await expect(downloadAccountSnapshot("GTEST1234567890")).rejects.toThrow(
      "Account not found"
    );
  });

  it("does not download partial file on Horizon failure", async () => {
    loadAccountMock.mockRejectedValue(new Error("Network error"));

    await expect(downloadAccountSnapshot("GTEST1234567890")).rejects.toThrow(
      "Network error"
    );

    // createElement should not be called if snapshot fails
    expect(globalThis.document.createElement).not.toHaveBeenCalled();
  });
});
