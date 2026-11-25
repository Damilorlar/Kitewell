import { describe, expect, it } from "vitest";
import { BUILDER_CSV_COLUMNS, buildersToCsv } from "./builderCsv";

const FIXTURES = [
  { address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", name: "stellar-alice" },
  { address: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", name: "acme, inc" },
];

function csvLines(csv) {
  return csv.split("\r\n").filter((line) => line !== "");
}

describe("buildersToCsv", () => {
  it("writes the address and name of every loaded builder", () => {
    expect(csvLines(buildersToCsv(FIXTURES))).toEqual([
      "address,name",
      `${FIXTURES[0].address},stellar-alice`,
      `${FIXTURES[1].address},"acme, inc"`,
    ]);
  });

  it("always writes the address and name header, in that order", () => {
    expect(BUILDER_CSV_COLUMNS).toEqual(["address", "name"]);
    expect(csvLines(buildersToCsv(FIXTURES))[0]).toBe("address,name");
  });

  it("quotes names containing commas and doubles embedded quotes", () => {
    const rows = [
      { address: "GCCC", name: "comma, name" },
      { address: "GDDD", name: 'quote " name' },
    ];
    expect(csvLines(buildersToCsv(rows))).toEqual([
      "address,name",
      'GCCC,"comma, name"',
      'GDDD,"quote "" name"',
    ]);
  });

  it("exports header-only CSV for an empty registry", () => {
    expect(csvLines(buildersToCsv([]))).toEqual(["address,name"]);
  });

  it("treats a missing name or a non-array input as empty", () => {
    expect(csvLines(buildersToCsv([{ address: "GEEE" }]))).toEqual([
      "address,name",
      "GEEE,",
    ]);
    expect(csvLines(buildersToCsv(undefined))).toEqual(["address,name"]);
  });
});
