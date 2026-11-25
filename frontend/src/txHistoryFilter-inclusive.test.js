import { describe, expect, it } from "vitest";
import { filterTransactionHistory } from "./txHistoryFilter";

describe("filterTransactionHistory inclusive bounds", () => {
  it("keeps a record created exactly at from and exactly at to", () => {
    const records = [
      { id: "start", type: "payment", created_at: "2026-01-01T00:00:00Z" },
      { id: "end", type: "payment", created_at: "2026-01-02T00:00:00Z" },
      { id: "after", type: "payment", created_at: "2026-01-02T00:00:01Z" },
    ];

    const kept = filterTransactionHistory(records, {
      from: "2026-01-01T00:00:00Z",
      to: "2026-01-02T00:00:00Z",
    });

    expect(kept.map((record) => record.id)).toEqual(["start", "end"]);
  });
});
