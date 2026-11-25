import { describe, expect, it } from "vitest";
import { escapeCsvField, rowsToCsv } from "./csvExport";

describe("CSV escaping - null/undefined/missing values", () => {
  it("renders null and undefined fields as empty strings", () => {
    expect(escapeCsvField(null)).toBe("");
    expect(escapeCsvField(undefined)).toBe("");
  });

  it("fills in an empty cell when a row is missing a column", () => {
    const rows = [{ date: "2026-01-01" }];
    expect(rowsToCsv(rows, ["date", "amount"])).toBe(
      "date,amount\r\n2026-01-01,\r\n"
    );
  });
});
