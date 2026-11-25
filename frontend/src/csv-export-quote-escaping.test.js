import { describe, expect, it } from "vitest";
import { escapeCsvField, rowsToCsv } from "./csvExport";

describe("CSV escaping - double quotes", () => {
  it("doubles internal double quotes and wraps the field in quotes", () => {
    expect(escapeCsvField('She said "hi"')).toBe('"She said ""hi"""');
  });

  it("escapes quotes in a full row", () => {
    const rows = [{ memo: 'Invoice "final"', amount: "5" }];
    expect(rowsToCsv(rows)).toBe('memo,amount\r\n"Invoice ""final""",5\r\n');
  });
});
