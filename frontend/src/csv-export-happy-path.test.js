import { describe, expect, it } from "vitest";
import { rowsToCsv } from "./csvExport";

describe("rowsToCsv - happy path", () => {
  it("builds a header row from the first row's keys plus one data row per entry", () => {
    const rows = [
      { date: "2026-01-01", amount: "10.5", asset: "USDC" },
      { date: "2026-01-02", amount: "3", asset: "XLM" },
    ];

    expect(rowsToCsv(rows)).toBe(
      "date,amount,asset\r\n2026-01-01,10.5,USDC\r\n2026-01-02,3,XLM\r\n"
    );
  });
});
