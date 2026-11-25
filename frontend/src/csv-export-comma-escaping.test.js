import { describe, expect, it } from "vitest";
import { escapeCsvField, rowsToCsv } from "./csvExport";

describe("CSV escaping - commas", () => {
  it("quotes a field that contains a comma", () => {
    expect(escapeCsvField("Payments, Inc.")).toBe('"Payments, Inc."');
  });

  it("escapes commas in a full row", () => {
    const rows = [{ memo: "rent, utilities", amount: "100" }];
    expect(rowsToCsv(rows)).toBe('memo,amount\r\n"rent, utilities",100\r\n');
  });
});
