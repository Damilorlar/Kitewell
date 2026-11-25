import { describe, expect, it } from "vitest";
import { filterTransactionHistory } from "./txHistoryFilter";

describe("filterTransactionHistory native asset", () => {
  it("matches native XLM when the asset filter is XLM", () => {
    const kept = filterTransactionHistory(
      [
        { id: "xlm", type: "payment", asset_type: "native" },
        { id: "usd", type: "payment", asset_type: "credit_alphanum4", asset_code: "USD" },
      ],
      { asset: "XLM" },
    );

    expect(kept.map((record) => record.id)).toEqual(["xlm"]);
  });
});
