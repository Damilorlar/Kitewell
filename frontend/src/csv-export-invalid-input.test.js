import { describe, expect, it } from "vitest";
import { rowsToCsv } from "./csvExport";

describe("rowsToCsv - invalid rows input", () => {
  it("treats a non-array rows argument as empty instead of throwing", () => {
    expect(() => rowsToCsv(null)).not.toThrow();
    expect(rowsToCsv(null)).toBe("");
    expect(rowsToCsv(undefined)).toBe("");
    expect(rowsToCsv("not-an-array")).toBe("");
  });

  it("skips a null entry in the rows array without throwing", () => {
    const rows = [{ date: "2026-01-01" }, null];
    expect(() => rowsToCsv(rows, ["date"])).not.toThrow();
    expect(rowsToCsv(rows, ["date"])).toBe("date\r\n2026-01-01\r\n\r\n");
  });
});
