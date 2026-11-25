import { describe, expect, it } from "vitest";
import { rowsToCsv } from "./csvExport";

describe("rowsToCsv - explicit column order", () => {
  it("uses the given column list and order instead of each row's own key order", () => {
    const rows = [{ amount: "10", date: "2026-01-01", asset: "XLM" }];
    expect(rowsToCsv(rows, ["asset", "date", "amount"])).toBe(
      "asset,date,amount\r\nXLM,2026-01-01,10\r\n"
    );
  });
});
