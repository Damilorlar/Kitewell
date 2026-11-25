import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CI-friendly test suite for the Kitewell stellar helpers.
 *
 * Nothing here touches the network or a Freighter wallet:
 * - `./api` is mocked so the "backend-backed" paths are simulated.
 * - The Horizon `Server` is mocked so the "Horizon fallback" paths are simulated.
 * - `globalThis.fetch` is stubbed for Friendbot funding.
 */

vi.mock("./api", () => ({
  fetchAccountViaApi: vi.fn(),
  fetchPaymentsViaApi: vi.fn(),
}));

const { loadAccountMock, paymentsCallMock, offersCallMock } = vi.hoisted(() => ({
  loadAccountMock: vi.fn(),
  paymentsCallMock: vi.fn(),
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
              order: () => ({ call: offersCallMock }),
            }),
          }),
          payments: () => ({
            forAccount: () => ({
              limit: () => ({
                order: () => ({ join: () => ({ call: paymentsCallMock }) }),
              }),
            }),
          }),
          orderbook: (selling, buying) => ({
            limit: () => ({
              call: () => orderBookCallMock(selling, buying),
            }),
          }),
          claimableBalances: () => ({
            forSponsor: () => ({ limit: () => ({ call: claimableCallMock }) }),
          }),
          assets: () => ({
            forCode: () => ({ forIssuer: () => ({ call: assetCallMock }) }),
          }),
        };
      }),
    },
  };
});

const { fetchAccountViaApi, fetchPaymentsViaApi } = await import("./api");
const StellarSdk = await import("@stellar/stellar-sdk");
const {
  buildAsset,
  buildManageSellOffer,
  explorerAccountUrl,
  explorerTxUrl,
  fundWithFriendbot,
  getLatestLedger,
  getAccountBalances,
  getAccountDetails,
  getAccountOffers,
  getBalance,
  getLatestBaseReserve,
  getTransactions,
  formatDataValue,
  mapAccountDataEntries,
  parsePathAssets,
  validateDataName,
  validateDataValue,
  validateAccountMerge,
  mergeBlockersFromAccount,
} = await import("./stellar");

/** Minimal Horizon account payload: 3.5 XLM + an issued asset. */
function horizonAccountFixture() {
  return {
    id: "GTEST",
    sequenceNumber: () => "123",
    subentry_count: 2,
    thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
    balances: [
      {
        asset_type: "native",
        balance: "3.5000000",
      },
      {
        asset_type: "credit_alphanum4",
        asset_code: "FOO",
        asset_issuer: "GISSUER",
        balance: "11.0000000",
        limit: "1000.0000000",
        is_authorized: false,
        is_authorized_to_maintain_liabilities: true,
        clawback_enabled: false,
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  loadAccountMock.mockReset();
  paymentsCallMock.mockReset();
  offersCallMock.mockReset();
  resetHorizon429BackoffForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetHorizon429BackoffForTests();
});

describe("explorer urls", () => {
  it("builds account and tx explorer urls on the testnet base", () => {
    expect(explorerAccountUrl("GTEST")).toBe(
      "https://stellar.expert/explorer/testnet/account/GTEST"
    );
    expect(explorerTxUrl("hash123")).toBe(
      "https://stellar.expert/explorer/testnet/tx/hash123"
    );
  });
});

describe("getLatestLedger", () => {
  it("maps sequence, UTC close time, base fee, and base reserve", async () => {
    ledgerCallMock.mockResolvedValue({
      records: [
        {
          sequence: 123456,
          closed_at: "2026-11-20T15:00:00Z",
          base_fee_in_stroops: 100,
          base_reserve_in_stroops: 5000000,
        },
      ],
    });

    await expect(getLatestLedger()).resolves.toEqual({
      sequence: 123456,
      closedAt: "2026-11-20T15:00:00.000Z",
      baseFeeInStroops: "100",
      baseReserveInStroops: "5000000",
    });
  });

  it("uses the explicitly selected network", async () => {
    ledgerCallMock.mockResolvedValue({
      records: [
        {
          sequence: 2,
          closed_at: "2026-11-20T15:00:00Z",
          base_fee_in_stroops: 100,
          base_reserve_in_stroops: 5000000,
        },
      ],
    });

    await getLatestLedger("FUTURENET");

    expect(StellarSdk.Horizon.Server).toHaveBeenCalledWith(
      "https://horizon-futurenet.stellar.org"
    );
  });

  it("rejects a ledger missing its base reserve instead of treating it as zero", async () => {
    ledgerCallMock.mockResolvedValue({
      records: [
        {
          sequence: 1,
          closed_at: "2026-11-20T15:00:00Z",
          base_fee_in_stroops: 100,
        },
      ],
    });

    await expect(getLatestLedger()).rejects.toThrow(
      "Latest ledger has an invalid base reserve."
    );
  });
});

describe("asset + path helpers", () => {
  const issuer = StellarSdk.Keypair.random().publicKey();

  it("builds a native XLM asset", () => {
    expect(buildAsset({ isNative: true }).isNative()).toBe(true);
  });

  it("builds a credit asset and upper-cases the code", () => {
    const asset = buildAsset({ isNative: false, code: "usdc", issuer });
    expect(asset.getCode()).toBe("USDC");
    expect(asset.getIssuer()).toBe(issuer);
  });

  it("rejects missing codes, bad issuers, and over-long codes", () => {
    expect(() => buildAsset({ isNative: false })).toThrow(/code is required/);
    expect(() =>
      buildAsset({ isNative: false, code: "USDC", issuer: "not-a-key" })
    ).toThrow(/valid Stellar public key/);
    expect(() =>
      buildAsset({ isNative: false, code: "TOOLONGCODE123", issuer })
    ).toThrow(/12 characters or fewer/);
  });

  it("parses an empty path to nothing", () => {
    expect(parsePathAssets("")).toEqual([]);
    expect(parsePathAssets("   ")).toEqual([]);
    expect(parsePathAssets(undefined)).toEqual([]);
  });

  it("parses native and credit hops", () => {
    const path = parsePathAssets(`USDC:${issuer}, xlm`);
    expect(path).toHaveLength(2);
    expect(path[0].getCode()).toBe("USDC");
    expect(path[0].getIssuer()).toBe(issuer);
    expect(path[1].isNative()).toBe(true);
  });

  it("rejects a credit hop without an issuer", () => {
    expect(() => parsePathAssets("USDC")).toThrow(/needs an issuer/);
  });
});

describe("manage sell offers", () => {
  const issuer = StellarSdk.Keypair.random().publicKey();

  it("builds a real sell offer with the collected assets and rational price", () => {
    const operation = buildManageSellOffer({
      selling: { isNative: false, code: "USD", issuer },
      buying: { isNative: true },
      amount: "2",
      priceNumerator: "3",
      priceDenominator: "2",
    });
    const payload = operation.body().manageSellOfferOp();

    expect(operation.body().switch().name).toBe("manageSellOffer");
    expect(payload.selling().switch().name).toBe("assetTypeCreditAlphanum4");
    expect(payload.buying().switch().name).toBe("assetTypeNative");
    expect(
      payload
        .selling()
        .alphaNum4()
        .assetCode()
        .toString()
        .replace(/\0/g, "")
    ).toBe("USD");
    expect(
      StellarSdk.StrKey.encodeEd25519PublicKey(
        payload.selling().alphaNum4().issuer().ed25519()
      )
    ).toBe(issuer);
    expect(payload.amount().toString()).toBe("20000000");
    expect(payload.price().n()).toBe(3);
    expect(payload.price().d()).toBe(2);
    expect(payload.offerId().toString()).toBe("0");
  });

  it("cancels the specified offer by building a zero-amount operation", () => {
    const operation = buildManageSellOffer({
      selling: { isNative: true },
      buying: { isNative: false, code: "USD", issuer },
      amount: "0",
      priceNumerator: "1",
      priceDenominator: "2",
      offerId: "123",
    });
    const payload = operation.body().manageSellOfferOp();

    expect(payload.amount().toString()).toBe("0");
    expect(payload.offerId().toString()).toBe("123");
  });

  it("rejects invalid price fractions and identical assets", () => {
    expect(() =>
      buildManageSellOffer({
        selling: { isNative: true },
        buying: { isNative: false, code: "USD", issuer },
        amount: "1",
        priceNumerator: "0",
        priceDenominator: "1",
      })
    ).toThrow(/Price numerator must be a positive integer/);

    expect(() =>
      buildManageSellOffer({
        selling: { isNative: true },
        buying: { isNative: true },
        amount: "1",
        priceNumerator: "1",
        priceDenominator: "1",
      })
    ).toThrow("Selling and buying assets must be different.");
  });
});

describe("getAccountOffers", () => {
  it("maps Horizon offer assets and exact price parts for cancellation", async () => {
    const issuer = StellarSdk.Keypair.random().publicKey();
    offersCallMock.mockResolvedValue({
      records: [
        {
          id: "123",
          selling: `USD:${issuer}`,
          buying: "native",
          amount: "5.0000000",
          price_r: { n: "3", d: "2" },
        },
      ],
    });

    await expect(getAccountOffers("GTEST")).resolves.toEqual([
      {
        offerId: "123",
        selling: { isNative: false, code: "USD", issuer },
        buying: { isNative: true },
        amount: "5.0000000",
        priceNumerator: "3",
        priceDenominator: "2",
      },
    ]);
  });
});

describe("fundWithFriendbot", () => {
  it("returns the friendbot JSON on success", async () => {
    const body = { hash: "abc123", successful: true };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => body })
    );

    await expect(fundWithFriendbot("GTEST")).resolves.toEqual(body);
    expect(fetch).toHaveBeenCalledWith(
      "https://friendbot.stellar.org?addr=GTEST"
    );
  });

  it("maps friendbot failures to a friendly error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve("oops"),
      })
    );

    await expect(fundWithFriendbot("GTEST")).rejects.toThrow(
      "Account may already be funded. Refresh balances instead."
    );
  });
});

describe("getBalance", () => {
  it("returns the native XLM balance", async () => {
    fetchAccountViaApi.mockResolvedValue({
      balances: [
        { key: "FOO:GISSUER", code: "FOO", balance: "11.0000000", isNative: false },
        { key: "native", code: "XLM", balance: "3.5000000", isNative: true },
      ],
    });

    await expect(getBalance("GTEST")).resolves.toBe("3.5000000");
    expect(fetchAccountViaApi).toHaveBeenCalledWith("GTEST", "TESTNET");
  });

  it("falls back to Horizon and reports 0 when no native balance exists", async () => {
    fetchAccountViaApi.mockRejectedValue(new Error("backend down"));
    loadAccountMock.mockResolvedValue({
      balances: [
        {
          asset_type: "credit_alphanum4",
          asset_code: "FOO",
          asset_issuer: "GISSUER",
          balance: "1.0000000",
          limit: "10.0000000",
        },
      ],
    });

    await expect(getBalance("GTEST")).resolves.toBe("0");
    expect(loadAccountMock).toHaveBeenCalledWith("GTEST");
  });
});

describe("getLatestBaseReserve", () => {
  it("reads the base reserve from the latest Horizon ledger", async () => {
    await expect(getLatestBaseReserve()).resolves.toBe("5000000");
    expect(ledgerCallMock).toHaveBeenCalledTimes(1);
  });

  it("fails explicitly when the latest ledger has no valid reserve", async () => {
    ledgerCallMock.mockResolvedValue({ records: [] });
    await expect(getLatestBaseReserve()).rejects.toThrow(
      "Latest ledger did not include a valid base reserve."
    );
  });
});

describe("balance mapping", () => {
  it("passes through backend-mapped balances untouched", async () => {
    fetchAccountViaApi.mockResolvedValue({
      balances: [
        { key: "native", code: "XLM", issuer: null, balance: "3.5000000", limit: null, isNative: true },
        {
          key: "FOO:GISSUER",
          code: "FOO",
          issuer: "GISSUER",
          balance: "11.0000000",
          limit: "1000.0000000",
          isNative: false,
          isAuthorized: false,
          isAuthorizedToMaintainLiabilities: true,
          clawbackEnabled: false,
        },
      ],
    });

    await expect(getAccountBalances("GTEST")).resolves.toEqual([
      { key: "native", code: "XLM", issuer: null, balance: "3.5000000", limit: null, isNative: true },
      {
        key: "FOO:GISSUER",
        code: "FOO",
        issuer: "GISSUER",
        balance: "11.0000000",
        limit: "1000.0000000",
        isNative: false,
        isAuthorized: false,
        isAuthorizedToMaintainLiabilities: true,
        clawbackEnabled: false,
      },
    ]);
  });

  it("normalizes raw Horizon balances on the fallback path", async () => {
    fetchAccountViaApi.mockRejectedValue(new Error("backend down"));
    loadAccountMock.mockResolvedValue(horizonAccountFixture());

    await expect(getAccountBalances("GTEST")).resolves.toEqual([
      { key: "native", code: "XLM", issuer: null, balance: "3.5000000", limit: null, isNative: true, sellingLiabilities: "0", buyingLiabilities: "0" },
      {
        key: "FOO:GISSUER",
        code: "FOO",
        issuer: "GISSUER",
        balance: "11.0000000",
        limit: "1000.0000000",
        isNative: false,
        sellingLiabilities: "0",
        buyingLiabilities: "0",
      },
    ]);
  });

  it("enriches account details with explorer url on the fallback path", async () => {
    fetchAccountViaApi.mockRejectedValue(new Error("backend down"));
    loadAccountMock.mockResolvedValue(horizonAccountFixture());

    const details = await getAccountDetails("GTEST");
    expect(details).toMatchObject({
      id: "GTEST",
      sequence: "123",
      subentryCount: 2,
      balances: expect.arrayContaining([
        expect.objectContaining({ code: "XLM", isNative: true }),
        expect.objectContaining({ code: "FOO", isNative: false }),
      ]),
      explorerUrl: "https://stellar.expert/explorer/testnet/account/GTEST",
    });
  });
});

describe("account merge helpers", () => {
  it("refuses the source as destination and mismatched retypes", () => {
    const source = StellarSdk.Keypair.random().publicKey();
    const destination = StellarSdk.Keypair.random().publicKey();

    expect(() =>
      validateAccountMerge(source, source, source)
    ).toThrow(/cannot be the connected account/);
    expect(() =>
      validateAccountMerge(source, destination, `${destination}x`)
    ).toThrow(/Retype the destination/);
  });

  it("lists trustlines, signers, and open offers as blockers", () => {
    const blockers = mergeBlockersFromAccount({
      balances: [
        { asset_type: "native", balance: "1" },
        { asset_type: "credit_alphanum4", asset_code: "USDC" },
      ],
      signers: [
        { key: "GSELF" },
        { key: "GEXTRA" },
      ],
      offers: [{ id: "123" }],
    });

    expect(blockers).toEqual([
      "Trustlines: USDC",
      "Signers: GSELF, GEXTRA",
      "Offers: 123",
    ]);
  });

  it("lists backend-mapped trustlines as blockers", () => {
    const blockers = mergeBlockersFromAccount({
      balances: [
        { isNative: true, code: "XLM" },
        { isNative: false, code: "USDC" },
      ],
    });

    expect(blockers).toEqual(["Trustlines: USDC"]);
  });
});

describe("account data helpers", () => {
  it("maps and sorts account data entries", () => {
    expect(mapAccountDataEntries({ data_attr: { z: "eg==", a: "aGVsbG8=" } })).toEqual([
      { name: "a", value: "aGVsbG8=" },
      { name: "z", value: "eg==" },
    ]);
  });

  it("reads the Horizon AccountResponse data method", () => {
    expect(
      mapAccountDataEntries({
        data_attr: undefined,
        data: () => ({ z: "eg==", a: "aGVsbG8=" }),
      })
    ).toEqual([
      { name: "a", value: "aGVsbG8=" },
      { name: "z", value: "eg==" },
    ]);
  });

  it("shows valid UTF-8 text and hex for invalid UTF-8", () => {
    expect(formatDataValue("aGVsbG8=")).toBe("hello");
    expect(formatDataValue("/w==")).toBe("ff");
  });

  it("checks data names and values by UTF-8 byte length", () => {
    expect(validateDataName("é".repeat(32))).toBe("é".repeat(32));
    expect(() => validateDataName("é".repeat(33))).toThrow(/64 UTF-8 bytes/);
    expect(validateDataValue("é".repeat(32))).toBe("é".repeat(32));
    expect(() => validateDataValue("é".repeat(33))).toThrow(/64 UTF-8 bytes/);
  });
});

describe("getTransactions", () => {
  it("returns the backend payment page when the API works", async () => {
    const records = [
      {
        id: "p1",
        from: "GALICE",
        to: "GTEST",
        amount: "1.0000000",
        asset_type: "native",
        asset_code: "XLM",
        transaction_hash: "h1",
        created_at: "2026-01-01T00:00:00Z",
        fee_charged: null,
        operation_count: null,
        fee_bumped: false,
      },
    ];
    const page = { records, nextCursor: "cursor-1" };
    fetchPaymentsViaApi.mockResolvedValue(page);

    await expect(getTransactions("GTEST")).resolves.toEqual(page);
    expect(fetchPaymentsViaApi).toHaveBeenCalledWith(
      "GTEST",
      15,
      undefined,
      "TESTNET"
    );
  });

  it("filters to payments and defaults non-native asset codes to XLM on fallback", async () => {
    fetchPaymentsViaApi.mockRejectedValue(new Error("backend down"));
    paymentsCallMock.mockResolvedValue({
      records: [
        {
          type: "payment",
          id: "p1",
          from: "GALICE",
          to: "GTEST",
          amount: "1.0000000",
          asset_type: "native",
          transaction_hash: "h1",
          created_at: "2026-01-01T00:00:00Z",
        },
        { type: "create_account", id: "skip-me" },
      ],
    });

    await expect(getTransactions("GTEST")).resolves.toEqual({
      records: [
        {
          id: "p1",
          from: "GALICE",
          to: "GTEST",
          amount: "1.0000000",
          asset_type: "native",
          asset_code: "XLM",
          transaction_hash: "h1",
          created_at: "2026-01-01T00:00:00Z",
          fee_charged: null,
          operation_count: null,
          fee_bumped: false,
        },
      ],
      // Paging straight off Horizon is out of scope, so this path ends here.
      nextCursor: null,
    });
    expect(paymentsCallMock).toHaveBeenCalledTimes(1);
  });
});

describe("balance liabilities", () => {
  it("includes selling and buying liabilities from Horizon with defaults", async () => {
    fetchAccountViaApi.mockRejectedValue(new Error("backend down"));
    loadAccountMock.mockResolvedValue({
      id: "GTEST",
      sequenceNumber: () => "123",
      subentry_count: 2,
      thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
      balances: [
        {
          asset_type: "native",
          balance: "100.0000000",
          selling_liabilities: "10.5000000",
          buying_liabilities: "5.2500000",
        },
        {
          asset_type: "credit_alphanum4",
          asset_code: "USDC",
          asset_issuer: "GISSUER",
          balance: "1000.0000000",
          limit: "5000.0000000",
          selling_liabilities: "200.0000000",
          buying_liabilities: "100.0000000",
        },
      ],
    });

    const balances = await getAccountBalances("GTEST");

    expect(balances).toEqual([
      {
        key: "native",
        code: "XLM",
        issuer: null,
        balance: "100.0000000",
        limit: null,
        isNative: true,
        sellingLiabilities: "10.5000000",
        buyingLiabilities: "5.2500000",
      },
      {
        key: "USDC:GISSUER",
        code: "USDC",
        issuer: "GISSUER",
        balance: "1000.0000000",
        limit: "5000.0000000",
        isNative: false,
        sellingLiabilities: "200.0000000",
        buyingLiabilities: "100.0000000",
      },
    ]);
  });

  it("defaults missing liability fields to zero", async () => {
    fetchAccountViaApi.mockRejectedValue(new Error("backend down"));
    loadAccountMock.mockResolvedValue({
      id: "GTEST",
      sequenceNumber: () => "123",
      subentry_count: 1,
      thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
      balances: [
        {
          asset_type: "native",
          balance: "50.0000000",
          // selling_liabilities and buying_liabilities omitted
        },
      ],
    });

    const balances = await getAccountBalances("GTEST");

    expect(balances[0].sellingLiabilities).toBe("0");
    expect(balances[0].buyingLiabilities).toBe("0");
  });
});
