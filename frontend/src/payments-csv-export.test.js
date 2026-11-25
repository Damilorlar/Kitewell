import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPaymentsCsv, getTransactionMemos, PAYMENTS_CSV_COLUMNS } from "./stellar";

const ME = "GME";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

const payments = [
  {
    id: "1",
    from: ME,
    to: "GOTHER",
    amount: "10.0000000",
    asset_code: "XLM",
    transaction_hash: HASH_A,
    created_at: "2026-01-02T03:04:05Z",
  },
  {
    id: "2",
    from: "GSENDER",
    to: ME,
    amount: "2.5000000",
    asset_code: "USDC",
    transaction_hash: HASH_B,
    created_at: "2026-01-01T00:00:00Z",
  },
];

afterEach(() => vi.unstubAllGlobals());

describe("buildPaymentsCsv", () => {
  it("writes one row per payment and quotes a memo with a comma or a quote", () => {
    const memos = new Map([
      [HASH_A, "rent, march"],
      [HASH_B, 'the "big" one'],
    ]);

    expect(buildPaymentsCsv(payments, ME, memos)).toBe(
      "time,direction,asset,amount,other_account,memo,hash\r\n" +
        `2026-01-02T03:04:05Z,sent,XLM,10.0000000,GOTHER,"rent, march",${HASH_A}\r\n` +
        `2026-01-01T00:00:00Z,received,USDC,2.5000000,GSENDER,"the ""big"" one",${HASH_B}\r\n`
    );
  });

  it("leaves the memo empty when a transaction has none", () => {
    const [, row] = buildPaymentsCsv([payments[0]], ME).trimEnd().split("\r\n");
    expect(row).toBe(`2026-01-02T03:04:05Z,sent,XLM,10.0000000,GOTHER,,${HASH_A}`);
  });

  it("gives a header and no rows for an empty list", () => {
    expect(buildPaymentsCsv([], ME)).toBe(`${PAYMENTS_CSV_COLUMNS.join(",")}\r\n`);
  });
});

describe("getTransactionMemos", () => {
  it("reads each distinct hash once and maps a missing memo to an empty string", async () => {
    const fetchMock = vi.fn(async (url) => ({
      ok: true,
      json: async () => (url.endsWith(HASH_A) ? { memo: "hello" } : {}),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const memos = await getTransactionMemos([HASH_A, HASH_B, HASH_A]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(memos.get(HASH_A)).toBe("hello");
    expect(memos.get(HASH_B)).toBe("");
  });

  it("rejects when a transaction cannot be read, so no partial memos are exported", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(getTransactionMemos([HASH_A])).rejects.toThrow("HTTP 500");
  });
});
