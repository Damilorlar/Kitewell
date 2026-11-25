import { describe, expect, it } from "vitest";
import {
  calculateMinimumBalance,
  parseXlmToStroops,
  remainsAboveMinimum,
} from "./accountReserve";

describe("account reserve calculations", () => {
  it("calculates a minimum balance from the ledger reserve and subentries", () => {
    expect(calculateMinimumBalance("5000000", 2)).toBe("2.0000000");
  });

  it("detects when a create-account would put the source below its minimum", () => {
    const minimum = parseXlmToStroops("2");

    expect(remainsAboveMinimum("4.5000000", "2.5", "100", minimum)).toBe(
      false
    );
    expect(remainsAboveMinimum("4.5000100", "2.5", "100", minimum)).toBe(
      true
    );
  });
});
