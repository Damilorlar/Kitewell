import { describe, expect, it } from "vitest";
import { parseHorizonError } from "./horizonErrorParse";

describe("parseHorizonError - invalid input", () => {
  it("throws for null input", () => {
    expect(() => parseHorizonError(null)).toThrow("Horizon error response is required and must be an object.");
  });

  it("throws for undefined input", () => {
    expect(() => parseHorizonError(undefined)).toThrow("Horizon error response is required and must be an object.");
  });

  it("throws for string input", () => {
    expect(() => parseHorizonError("not an object")).toThrow("Horizon error response is required and must be an object.");
  });

  it("throws for array input", () => {
    expect(() => parseHorizonError([])).toThrow("Horizon error response is required and must be an object.");
  });

  it("throws for number input", () => {
    expect(() => parseHorizonError(400)).toThrow("Horizon error response is required and must be an object.");
  });
});