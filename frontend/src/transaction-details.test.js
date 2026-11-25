import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getTransactionDetails } from "./stellar";
import { TransactionDetailsView } from "./TransactionDetails";
import { describeEffect, operationName } from "./txDetails";

const HASH = "cd".repeat(32);
const BASE = "https://horizon-testnet.stellar.org";
const EXPLORER = `https://stellar.expert/explorer/testnet/tx/${HASH}`;

const operations = [
  { id: "1", type: "create_account" },
  { id: "2", type: "payment" },
];
const effects = [
  { id: "e1", type: "account_credited", account: "GRECEIVER", amount: "5.0000000", asset_type: "native" },
];

function stubFetch(transaction) {
  const fetchMock = vi.fn(async (url) => {
    if (url.includes("/operations")) {
      return { ok: true, status: 200, json: async () => ({ _embedded: { records: operations } }) };
    }
    if (url.includes("/effects")) {
      return { ok: true, status: 200, json: async () => ({ _embedded: { records: effects } }) };
    }
    return { ok: true, status: 200, json: async () => transaction };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("transaction details", () => {
  it("renders two named operations, one effect line, and the explorer link", async () => {
    stubFetch({ hash: HASH, successful: true });
    const details = await getTransactionDetails(HASH);
    const html = renderToStaticMarkup(createElement(TransactionDetailsView, { details }));

    expect(html).toContain("Create account");
    expect(html).toContain("Payment");
    expect(html).toContain("Account credited · 5.0000000 XLM · GRECEIVER");
    expect(html.match(/<li/g)).toHaveLength(3);
    expect(html).toContain(`href="${EXPLORER}"`);
  });

  it("opens a failed transaction and marks its operations failed", async () => {
    const fetchMock = stubFetch({ hash: HASH, successful: false });
    const details = await getTransactionDetails(HASH);
    const html = renderToStaticMarkup(
      createElement(TransactionDetailsView, {
        details: {
          ...details,
          operations: [{ id: "1", type: "payment", transaction_successful: false }],
        },
      })
    );

    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/transactions/${HASH}/operations?limit=200&include_failed=true`);
    expect(html).toContain("Failed");
    expect(html).toContain("Payment · Failed");
  });

  it("does not start a second request while the first load is in flight", async () => {
    const fetchMock = stubFetch({ hash: HASH, successful: true });
    const [first, second] = await Promise.all([
      getTransactionDetails(HASH),
      getTransactionDetails(HASH),
    ]);

    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("names unknown operation types and effects without a stored label", () => {
    expect(operationName("future_op")).toBe("Future op");
    expect(describeEffect({ type: "trustline_created" })).toBe("Trustline created");
  });

  it("shows a load error", () => {
    const html = renderToStaticMarkup(
      createElement(TransactionDetailsView, { error: "Transaction not found on this network." })
    );
    expect(html).toContain('role="alert"');
  });
});
