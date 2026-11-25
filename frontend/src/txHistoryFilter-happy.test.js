import { describe, expect, it } from "vitest";
import { filterTransactionHistory } from "./txHistoryFilter";

describe("filterTransactionHistory combined criteria", () => {
  it("keeps payments that match type, asset, and date range", () => {
    const kept = filterTransactionHistory(
      [
        { id: "1", type: "payment", asset_code: "USD", created_at: "2026-01-02T00:00:00Z" },
        { id: "2", type: "payment", asset_code: "EUR", created_at: "2026-01-02T00:00:00Z" },
        { id: "3", type: "create_account", asset_code: "USD", created_at: "2026-01-02T00:00:00Z" },
      ],
      { type: "payment", asset: "USD", from: "2026-01-01T00:00:00Z", to: "2026-01-03T00:00:00Z" },
    );

    expect(kept.map((record) => record.id)).toEqual(["1"]);
  });
});
