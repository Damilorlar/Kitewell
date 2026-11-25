import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A streamed payment has to render exactly like a paged one.
 *
 * `./stellar` is loaded with its Horizon server mocked, so `getTransactions`
 * returns a real mapped record from a real Horizon-shaped payload, and the
 * stream mapper is asserted against that same payload.
 */

vi.mock("./api", () => ({
  fetchAccountViaApi: vi.fn(),
  fetchPaymentsViaApi: vi.fn(),
}));

const { paymentsCallMock } = vi.hoisted(() => ({ paymentsCallMock: vi.fn() }));

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
              limit: () => ({ order: () => ({ join: () => ({ call: paymentsCallMock }) }) }),
            }),
          }),
        };
      }),
    },
  };
});

const { fetchPaymentsViaApi } = await import("./api");
const StellarSdk = await import("@stellar/stellar-sdk");
const { getTransactions } = await import("./stellar");
const { mapStreamPayment } = await import("./paymentStream");

const ACCOUNT = StellarSdk.Keypair.random().publicKey();
const COUNTERPARTY = StellarSdk.Keypair.random().publicKey();
const ISSUER = StellarSdk.Keypair.random().publicKey();

function paymentEvent({ assetCode = "USD", type = "payment" } = {}) {
  return {
    _links: { self: { href: "https://horizon-testnet.stellar.org/payments/1-1" } },
    id: "19880661651456-0000000001",
    paging_token: "19880661651456-0000000001",
    transaction_successful: true,
    type,
    type_i: 6,
    created_at: "2026-11-20T12:00:00Z",
    transaction_hash: "a".repeat(64),
    source_account: ACCOUNT,
    transaction_source_account: ACCOUNT,
    from: ACCOUNT,
    to: COUNTERPARTY,
    asset_type: "credit_alphanum4",
    asset_code: assetCode,
    asset_issuer: ISSUER,
    amount: "12.5000000",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Force the Horizon fallback path in getTransactions.
  fetchPaymentsViaApi.mockRejectedValue(new Error("backend unavailable"));
  paymentsCallMock.mockResolvedValue({ records: [paymentEvent()] });
});

describe("mapStreamPayment", () => {
  it("produces the same record the paged history shows for the same event", async () => {
    const paged = await getTransactions(ACCOUNT, 15);
    const streamed = mapStreamPayment(paymentEvent());

    expect(paged.records).toHaveLength(1);
    expect(streamed).toEqual(paged.records[0]);
    expect(Object.keys(streamed)).toEqual(Object.keys(paged.records[0]));
  });

  it("labels the native asset XLM exactly like history does", async () => {
    const native = paymentEvent({ assetCode: undefined });
    delete native.asset_code;
    delete native.asset_issuer;
    native.asset_type = "native";
    paymentsCallMock.mockResolvedValue({ records: [native] });

    const paged = await getTransactions(ACCOUNT, 15);
    expect(mapStreamPayment(native)).toEqual(paged.records[0]);
    expect(mapStreamPayment(native).asset_code).toBe("XLM");
  });

  it("adds nothing that the event did not carry", () => {
    const record = mapStreamPayment(paymentEvent());
    expect(Object.keys(record).sort()).toEqual(
      [
        "amount",
        "asset_code",
        "asset_type",
        "created_at",
        "fee_bumped",
        "fee_charged",
        "from",
        "id",
        "operation_count",
        "to",
        "transaction_hash",
      ].sort()
    );
    expect(record).not.toHaveProperty("paging_token");
    expect(record).not.toHaveProperty("asset_issuer");
  });

  it("ignores events that are not payments", () => {
    for (const type of [
      "create_claimable_balance",
      "claim_claimable_balance",
      "account_merge",
      "manage_data",
    ]) {
      expect(mapStreamPayment(paymentEvent({ type }))).toBeNull();
    }
    expect(mapStreamPayment(undefined)).toBeNull();
    expect(mapStreamPayment(null)).toBeNull();
    expect(mapStreamPayment("a payment")).toBeNull();
    expect(mapStreamPayment({})).toBeNull();
  });
});
