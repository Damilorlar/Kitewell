import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getTransactionByHash } from "./stellar";
import { TransactionHashOutcome } from "./TransactionHashLookup";

const HASH = "ab".repeat(32);
const BASE = "https://horizon-testnet.stellar.org";

afterEach(() => vi.unstubAllGlobals());

describe("transaction hash lookup", () => {
  it("reads one transaction and renders its result, charged fee, and operations", async () => {
    const transaction = { hash: HASH, successful: false, fee_charged: "200" };
    const operations = [
      { id: "1", type: "payment", from: "GSENDER", to: "GRECEIVER", amount: "2.5000000", asset_code: "USD" },
      { id: "2", type: "manage_data", source_account: "GSENDER" },
    ];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => transaction })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ _embedded: { records: operations } }) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getTransactionByHash(HASH.toUpperCase());
    expect(fetchMock).toHaveBeenNthCalledWith(1, `${BASE}/transactions/${HASH}`, { signal: undefined });
    expect(fetchMock).toHaveBeenNthCalledWith(2, `${BASE}/transactions/${HASH}/operations?limit=200`, { signal: undefined });

    const html = renderToStaticMarkup(createElement(TransactionHashOutcome, { result }));
    expect(html).toContain("Failed");
    expect(html).toContain("200 stroops");
    expect(html).toContain("Operation 1 · payment");
    expect(html).toContain("Operation 2 · manage_data");
    expect(html).toContain("2.5000000");
    expect(html).toContain("GRECEIVER");
  });

  it("rejects a wrong-length hash before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(getTransactionByHash(HASH.slice(1))).rejects.toThrow("64 hexadecimal characters");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says when Horizon does not have the transaction", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal("fetch", fetchMock);
    const error = await getTransactionByHash(HASH).catch((cause) => cause.message);
    const html = renderToStaticMarkup(createElement(TransactionHashOutcome, { error }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("Transaction not found on this network.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
