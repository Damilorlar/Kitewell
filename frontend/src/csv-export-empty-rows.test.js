import { describe, expect, it } from "vitest";
import { rowsToCsv } from "./csvExport";

describe("rowsToCsv - empty input", () => {
  it("returns an empty string when there are no rows and no explicit columns", () => {
    expect(rowsToCsv([])).toBe("");
  });

  it("emits only a header row when columns are given but rows are empty", () => {
    expect(rowsToCsv([], ["date", "amount"])).toBe("date,amount\r\n");
  });
});
